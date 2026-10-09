class Thred < ApplicationRecord
  self.primary_key = "id"

  # Both columns are NOT NULL in the database. Without this the controller would
  # raise a constraint violation and return a 500 instead of a validation error.
  validates :subject, presence: true
  validates :board_type, presence: true

  has_many :posts, foreign_key: "thred_id"
end
