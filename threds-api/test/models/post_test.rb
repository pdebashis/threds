require "test_helper"

class PostTest < ActiveSupport::TestCase
  def build_post(attributes = {})
    Post.new({ thred: threds(:"test-thred-1"), author: "Anonymous", timestamp: 1 }.merge(attributes))
  end

  test "rejects content shorter than the minimum word count when no image is attached" do
    post = build_post(content: "too short")

    assert_not post.valid?
    assert_includes post.errors[:content].to_sentence, "at least 3 words"
  end

  test "accepts content at the minimum word count" do
    post = build_post(content: "three whole words")

    assert post.valid?, post.errors.full_messages.to_sentence
  end

  test "accepts a short caption when an image is attached" do
    post = build_post(content: "ok", image_url: "https://example.com/a.png")

    assert post.valid?, post.errors.full_messages.to_sentence
  end

  test "rejects a post with neither content nor an image" do
    post = build_post(content: nil)

    assert_not post.valid?
  end

  test "rejects content-less posts even when an image is attached" do
    post = build_post(content: nil, image_url: "https://example.com/a.png")

    assert_not post.valid?
    assert_includes post.errors[:content].to_sentence, "blank"
  end

  test "reports the word count" do
    assert_equal 3, build_post(content: "one two three").word_count
    assert_equal 0, build_post(content: nil).word_count
  end
end
