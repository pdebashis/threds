class GridCellFormat < ApplicationRecord
  COLORS = %w[slate rose amber emerald sky violet].freeze

  belongs_to :grid_item, touch: true, inverse_of: :cell_formats

  validates :row_index, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: ->(format) { format.grid_item&.max_rows || GridItem::MAX_DIMENSION }
  }
  validates :column_index, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: ->(format) { format.grid_item&.max_columns || GridItem::MAX_DIMENSION }
  }
  validates :row_index, uniqueness: { scope: %i[grid_item_id column_index] }
  validates :bold, inclusion: { in: [true, false] }
  validates :color, inclusion: { in: COLORS }, allow_nil: true
end
