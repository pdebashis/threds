class ReportedPost < ApplicationRecord
  self.primary_key = "id"

  belongs_to :thred, class_name: "Thred", foreign_key: "thred_id", optional: true

  validates :thred_id, presence: true
  validates :post_id, presence: true
  validates :post_content, presence: true
  validates :report_reason, presence: true
  validates :reported_at, presence: true
end
