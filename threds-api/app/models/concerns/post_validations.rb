# Shared content rules for a post.
#
# Included by `Post` so the rule is enforced on every write, not just by
# controllers. `Thred` deliberately does *not* include this: a thred stores the
# text of its opening post on the associated post row, so the opening post is
# validated as a `Post` in the controller before the thred is created.
module PostValidations
  extend ActiveSupport::Concern

  MINIMUM_WORDS = 3

  included do
    validates :content, presence: { message: "can't be blank" }
    validate :content_has_enough_words_unless_image
  end

  # A post counts as an image post if a URL was supplied directly or produced by
  # a Cloudinary upload. `image_url` is the only persisted signal, so every
  # creation path must set it before validation runs.
  def image_attached?
    image_url.present?
  end

  def word_count
    content.to_s.split.length
  end

  # Public so a controller can test the rule on an unsaved record without
  # tripping unrelated validations, such as the `belongs_to` presence check on a
  # `Post` that has not been attached to its thred yet.
  def content_words_sufficient?
    image_attached? || word_count >= MINIMUM_WORDS
  end

  private

  def content_has_enough_words_unless_image
    # Leave blank content to the presence validation rather than stacking a
    # second, noisier message on the same field.
    return if content.blank?
    return if content_words_sufficient?

    errors.add(:content, "must be at least #{MINIMUM_WORDS} words unless an image is attached")
  end
end
