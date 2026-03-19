class Thred < ApplicationRecord
  self.primary_key = "id"
  has_many :posts, foreign_key: "thred_id"
end