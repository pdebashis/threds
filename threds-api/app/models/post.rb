class Post < ApplicationRecord
  self.primary_key = "id"
  belongs_to :thred, class_name: "Thred", foreign_key: "thred_id"
end