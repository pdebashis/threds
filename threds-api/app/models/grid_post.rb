class GridPost < ApplicationRecord
  self.primary_key = "id"
  MAX_CONTENT_LENGTH = 2_000

  belongs_to :grid_cell, touch: true, inverse_of: :posts

  before_validation :set_created_at
  before_create :assign_id

  validates :content, presence: true, length: { maximum: MAX_CONTENT_LENGTH }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end

  def set_created_at
    self.created_at ||= Time.current
  end
end
