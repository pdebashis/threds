class GridCell < ApplicationRecord
  belongs_to :grid_item, touch: true, inverse_of: :cells
  has_many :posts, class_name: "GridPost", dependent: :destroy, inverse_of: :grid_cell

  validates :row_index, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: ->(cell) { cell.grid_item&.max_rows || GridItem::MAX_DIMENSION }
  }
  validates :column_index, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: ->(cell) { cell.grid_item&.max_columns || GridItem::MAX_DIMENSION }
  }
  validates :row_index, uniqueness: { scope: %i[grid_item_id column_index] }
end
