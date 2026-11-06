# Shared content rules for a post.
#
# Included by `Post` so the rule is enforced on every write, not just by
# controllers. `Thred` deliberately does *not* include this: a thred stores the
# text of its opening post on the associated post row, so the opening post is
# validated as a `Post` in the controller before the thred is created.
module PostValidations
  extend ActiveSupport::Concern

  included do
    before_validation :normalize_blank_content_for_image
    validates :content, presence: { message: "can't be blank" }, unless: :image_attached?
  end

  def image_attached?
    image_url.present?
  end

  private

  def normalize_blank_content_for_image
    self.content = "" if image_attached? && content.blank?
  end
end
