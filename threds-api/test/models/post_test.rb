require "test_helper"

class PostTest < ActiveSupport::TestCase
  def build_post(attributes = {})
    Post.new({ thred: threds(:"test-thred-1"), author: "Anonymous", timestamp: 1 }.merge(attributes))
  end

  test "accepts a short post without an image" do
    post = build_post(content: "short")

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

  test "accepts a content-less post when an image is attached" do
    post = build_post(content: nil, image_url: "https://example.com/a.png")

    assert post.valid?, post.errors.full_messages.to_sentence
    assert_equal "", post.content
  end

end
