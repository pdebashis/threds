class ReportedPost < ApplicationRecord
  self.primary_key = "id"

  # String primary key with no database default, so a record built without an
  # explicit id cannot be saved. Posts and threds already get their ids from the
  # application; this makes the model self-sufficient for the same reason.
  before_create :assign_id

  belongs_to :thred, class_name: "Thred", foreign_key: "thred_id", optional: true

  validates :thred_id, presence: true
  validates :post_id, presence: true
  validates :post_content, presence: true
  validates :report_reason, presence: true
  validates :reported_at, presence: true

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end
