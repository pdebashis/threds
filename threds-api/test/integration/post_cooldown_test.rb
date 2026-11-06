require "test_helper"

class PostCooldownTest < ActionDispatch::IntegrationTest
  def other_thred
    Thred.create!(
      id: SecureRandom.uuid,
      board_type: "w",
      subject: "Another fixture thred",
      timestamp: 1
    )
  end

  def reply(thred, ip, content)
    post "/threds/#{thred.id}/posts",
         params: { content: content },
         as: :json,
         headers: { "X-Forwarded-For" => ip }
  end

  test "first post from an ip succeeds" do
    reply(fixture_thred, "198.51.100.7", "a reply with enough words")

    assert_response :success
  end

  test "a second immediate post from the same ip is refused with 429" do
    thred = other_thred

    reply(thred, "198.51.100.7", "first reply with enough words")
    assert_response :success

    reply(thred, "198.51.100.7", "second reply with enough words")

    assert_response :too_many_requests
    assert_includes response.parsed_body["error"], "posting too quickly"
    assert response.headers["Retry-After"].present?
  end

  test "the cooldown is per ip and does not block a different ip" do
    thred = other_thred

    reply(thred, "198.51.100.7", "first reply with enough words")
    assert_response :success

    reply(thred, "203.0.113.9", "reply from another client")

    assert_response :success
  end

  test "a short reply without an image is accepted" do
    reply(fixture_thred, "198.51.100.8", "short")

    assert_response :success
    assert_equal "short", response.parsed_body["content"]
  end

  test "a blank reply without an image is rejected" do
    reply(fixture_thred, "198.51.100.10", "")

    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "can't be blank"
  end

  test "a short reply is accepted when an image url is attached" do
    thred = other_thred

    post "/threds/#{thred.id}/posts",
         params: { content: "ok", imageUrl: "https://example.com/a.png" },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.11" }

    assert_response :success
  end

  test "an image-only reply is accepted" do
    thred = other_thred

    post "/threds/#{thred.id}/posts",
         params: { content: "", imageUrl: "https://example.com/a.png" },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.12" }

    assert_response :success
    assert_equal "", response.parsed_body["content"]
    assert_equal "https://example.com/a.png", response.parsed_body["imageUrl"]
  end

  private

  def fixture_thred
    threds(:"test-thred-1")
  end
end
