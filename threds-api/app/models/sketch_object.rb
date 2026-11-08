class SketchObject < ApplicationRecord
  self.primary_key = "id"

  TYPES = %w[stroke rectangle ellipse line arrow image].freeze
  CANVAS_SIZE = 4000
  MAX_DATA_BYTES = 1_000_000

  belongs_to :thred, foreign_key: "thred_id"
  serialize :data, coder: JSON, type: Hash

  validates :operation_id, presence: true, length: { maximum: 100 }
  validates :object_type, inclusion: { in: TYPES }
  validates :data, presence: true
  validate :validate_drawing_data

  after_create_commit :broadcast_creation

  def as_json(*)
    {
      id: id,
      operationId: operation_id,
      type: object_type,
      data: data,
      createdAt: created_at.iso8601(3)
    }
  end

  private

  def validate_drawing_data
    return unless data.is_a?(Hash) && TYPES.include?(object_type)

    allowed_keys = {
      "stroke" => %w[points color strokeWidth],
      "rectangle" => %w[x1 y1 x2 y2 color strokeWidth],
      "ellipse" => %w[x1 y1 x2 y2 color strokeWidth],
      "line" => %w[x1 y1 x2 y2 color strokeWidth],
      "arrow" => %w[x1 y1 x2 y2 color strokeWidth],
      "image" => %w[url x y width height supersedesOperationId]
    }.fetch(object_type)
    if (data.keys - allowed_keys).any?
      errors.add(:data, "contains unsupported fields")
      return
    end

    if data.to_json.bytesize > MAX_DATA_BYTES
      errors.add(:data, "is too large")
      return
    end

    case object_type
    when "stroke"
      validate_stroke
    when "rectangle", "ellipse", "line", "arrow"
      validate_shape
    when "image"
      validate_image
    end
  end

  def validate_stroke
    points = data["points"]
    unless points.is_a?(Array) && points.length.between?(1, 15_000)
      errors.add(:data, "must include between 1 and 15000 stroke points")
      return
    end

    points.each do |point|
      unless point.is_a?(Hash) && valid_coordinate?(point["x"]) && valid_coordinate?(point["y"])
        errors.add(:data, "contains an invalid stroke point")
        return
      end
    end

    validate_style
  end

  def validate_shape
    %w[x1 y1 x2 y2].each do |coordinate|
      unless valid_coordinate?(data[coordinate])
        errors.add(:data, "contains an invalid shape coordinate")
        return
      end
    end
    validate_style
  end

  def validate_image
    if data.key?("supersedesOperationId")
      superseded_operation_id = data["supersedesOperationId"]
      superseded_object = thred.sketch_objects.find_by(operation_id: superseded_operation_id) if superseded_operation_id.is_a?(String) && superseded_operation_id.length <= 100
      unless superseded_object&.object_type == "image"
        errors.add(:data, "must reference an existing image when replacing one")
        return
      end
    end

    url = data["url"]
    uri = URI.parse(url) if url.is_a?(String)
    unless uri&.is_a?(URI::HTTP) && uri.host.present? && url.length <= 2048
      errors.add(:data, "must include a valid image URL")
      return
    end

    %w[x y width height].each do |coordinate|
      value = data[coordinate]
      unless valid_coordinate?(value) && (coordinate == "x" || coordinate == "y" || value.positive?)
        errors.add(:data, "contains an invalid image dimension or position")
        return
      end
    end
  rescue URI::InvalidURIError
    errors.add(:data, "must include a valid image URL")
  end

  def validate_style
    unless data["color"].is_a?(String) && data["color"].match?(/\A#[0-9a-fA-F]{6}\z/)
      errors.add(:data, "must include a valid color")
    end

    width = data["strokeWidth"]
    unless width.is_a?(Numeric) && width.finite? && width.between?(1, 100)
      errors.add(:data, "must include a valid stroke width")
    end
  end

  def valid_coordinate?(value)
    value.is_a?(Numeric) && value.finite? && value.between?(0, CANVAS_SIZE)
  end

  def broadcast_creation
    ActionCable.server.broadcast(
      "sketch:#{thred_id}",
      { operation: as_json }
    )
  end
end
