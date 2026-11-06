require "set"

class GridController < ApplicationController
  before_action :set_grid_item, only: %i[show cells cell create_post update_format]

  def index
    items = GridItem.order(updated_at: :desc, id: :asc)
    item_ids = items.map(&:id)
    post_counts = GridPost.joins(grid_cell: :grid_item)
                          .where(grid_threds: { id: item_ids })
                          .group("grid_threds.id")
                          .count
    populated_positions = Hash.new { |hash, item_id| hash[item_id] = Set.new }
    GridCell.joins(:posts).where(grid_item_id: item_ids).distinct.pluck(:grid_item_id, :row_index, :column_index)
            .each { |item_id, row, column| populated_positions[item_id] << [row, column] }
    GridCellFormat.where(grid_item_id: item_ids)
                  .where("bold = ? OR color IS NOT NULL", true)
                  .pluck(:grid_item_id, :row_index, :column_index)
                  .each { |item_id, row, column| populated_positions[item_id] << [row, column] }

    render json: items.map { |item|
      serialize_item(
        item,
        post_count: post_counts.fetch(item.id, 0),
        populated_cells: populated_positions[item.id].length
      )
    }
  end

  def show
    render json: serialize_item(@grid_item)
  end

  def create
    access = params[:access].presence || "public"
    unless GridItem::ACCESS_TYPES.include?(access)
      return render json: { error: "Access must be public or keyed" }, status: :unprocessable_entity
    end

    key = params[:accessKey].to_s
    if access == "keyed" && (key.length < GridItem::MIN_ACCESS_KEY_LENGTH || key.length > GridItem::MAX_ACCESS_KEY_LENGTH)
      return render json: { error: "Grid key must be between #{GridItem::MIN_ACCESS_KEY_LENGTH} and #{GridItem::MAX_ACCESS_KEY_LENGTH} characters" },
                    status: :unprocessable_entity
    end

    item = GridItem.new(subject: params[:subject], access: access)
    item.set_access_key(key) if access == "keyed"

    unless item.save
      return render json: { error: item.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    render json: serialize_item(item), status: :created
  end

  def cells
    range = requested_range
    return render json: { error: "Cell range coordinates must be integers" }, status: :unprocessable_entity unless range

    row_start, row_end, column_start, column_end = clamp_range(range)
    cell_scope = @grid_item.cells.where(row_index: row_start..row_end, column_index: column_start..column_end)
    cells_with_posts = cell_scope.joins(:posts).distinct.includes(:posts).index_by do |cell|
      [cell.row_index, cell.column_index]
    end
    formats = @grid_item.cell_formats
                        .where(row_index: row_start..row_end, column_index: column_start..column_end)
                        .where("bold = ? OR color IS NOT NULL", true)

    positions = (cells_with_posts.keys | formats.map { |format| [format.row_index, format.column_index] }).sort
    format_by_position = formats.index_by { |format| [format.row_index, format.column_index] }

    render json: {
      cells: positions.map do |row, column|
        serialize_cell(
          row,
          column,
          cells_with_posts[[row, column]]&.posts,
          format_by_position[[row, column]]
        )
      end
    }
  end

  def cell
    position = requested_position
    return render json: { error: "Cell coordinates must be integers" }, status: :unprocessable_entity unless position
    return render json: { error: "Cell is outside this Grid's bounds" }, status: :unprocessable_entity unless valid_position?(position)

    render json: { cell: serialized_cell_at(position) }
  end

  def create_post
    return unless authorize_write

    position = requested_position
    return render json: { error: "Cell coordinates must be integers" }, status: :unprocessable_entity unless position
    return render json: { error: "Cell is outside this Grid's bounds" }, status: :unprocessable_entity unless valid_position?(position)

    content = params[:content].to_s.strip
    if content.blank? || content.length > GridPost::MAX_CONTENT_LENGTH
      return render json: { error: "Post content must be between 1 and #{GridPost::MAX_CONTENT_LENGTH} characters" },
                    status: :unprocessable_entity
    end

    cell = @grid_item.cells.find_or_create_by!(row_index: position[:row], column_index: position[:column])
    cell.posts.create!(content: content)

    render json: { cell: serialized_cell_at(position) }, status: :created
  rescue ActiveRecord::RecordInvalid => error
    render json: { error: error.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def update_format
    return unless authorize_write

    position = requested_position
    return render json: { error: "Cell coordinates must be integers" }, status: :unprocessable_entity unless position
    return render json: { error: "Cell is outside this Grid's bounds" }, status: :unprocessable_entity unless valid_position?(position)

    format_params = params.permit(:bold, :color)
    unless format_params.key?(:bold) && (format_params[:bold] == true || format_params[:bold] == false)
      return render json: { error: "Bold must be a boolean" }, status: :unprocessable_entity
    end

    color = format_params[:color].presence
    if color.present? && !GridCellFormat::COLORS.include?(color)
      return render json: { error: "Unsupported cell colour" }, status: :unprocessable_entity
    end

    attributes = { bold: format_params[:bold], color: color }
    existing = @grid_item.cell_formats.find_by(row_index: position[:row], column_index: position[:column])

    if attributes == { bold: false, color: nil }
      existing&.destroy!
    else
      format = existing || @grid_item.cell_formats.new(row_index: position[:row], column_index: position[:column])
      unless format.update(attributes)
        return render json: { error: format.errors.full_messages.to_sentence }, status: :unprocessable_entity
      end
    end

    render json: { cell: serialized_cell_at(position) }
  end

  private

  def set_grid_item
    @grid_item = GridItem.find(params[:item_id])
  end

  def serialize_item(item, post_count: nil, populated_cells: nil)
    if post_count.nil? || populated_cells.nil?
      post_count = GridPost.joins(grid_cell: :grid_item).where(grid_threds: { id: item.id }).count
      format_positions = item.cell_formats.where("bold = ? OR color IS NOT NULL", true).pluck(:row_index, :column_index)
      post_positions = GridCell.joins(:posts).where(grid_item_id: item.id).distinct.pluck(:row_index, :column_index)
      populated_cells = (format_positions | post_positions).length
    end

    {
      id: item.id,
      subject: item.subject,
      access: item.access,
      createdAt: item.created_at.to_f * 1000,
      updatedAt: item.updated_at.to_f * 1000,
      maxRows: item.max_rows,
      maxColumns: item.max_columns,
      populatedCells: populated_cells,
      postCount: post_count
    }
  end

  def requested_range
    %i[rowStart rowEnd columnStart columnEnd].map do |key|
      Integer(params[key], 10)
    rescue ArgumentError, TypeError
      return nil
    end
  end

  def clamp_range(range)
    row_start, row_end, column_start, column_end = range
    [
      [[row_start, 1].max, @grid_item.max_rows].min,
      [[row_end, 1].max, @grid_item.max_rows].min,
      [[column_start, 1].max, @grid_item.max_columns].min,
      [[column_end, 1].max, @grid_item.max_columns].min
    ]
  end

  def requested_position
    {
      row: Integer(params[:row], 10),
      column: Integer(params[:column], 10)
    }
  rescue ArgumentError, TypeError
    nil
  end

  def valid_position?(position)
    position[:row].between?(1, @grid_item.max_rows) &&
      position[:column].between?(1, @grid_item.max_columns)
  end

  def serialized_cell_at(position)
    cell = @grid_item.cells.find_by(row_index: position[:row], column_index: position[:column])
    posts = cell&.posts&.order(:created_at, :id)&.to_a || []
    format = @grid_item.cell_formats.find_by(row_index: position[:row], column_index: position[:column])

    return nil if posts.empty? && (!format || (!format.bold? && format.color.blank?))

    serialize_cell(position[:row], position[:column], posts, format)
  end

  def serialize_cell(row, column, posts, format)
    posts ||= []
    {
      row: row,
      column: column,
      format: { bold: format&.bold || false, color: format&.color },
      posts: posts.map do |post|
        { id: post.id, content: post.content, createdAt: post.created_at.to_f * 1000 }
      end,
      postCount: posts.length,
      updatedAt: [posts.last&.created_at, format&.updated_at].compact.max&.to_f.to_f * 1000
    }
  end

  def authorize_write
    return true if @grid_item.accepts_access_key?(request.headers["X-Grid-Access-Key"])

    render json: { error: "A valid Grid key is required to write" }, status: :forbidden
    false
  end
end
