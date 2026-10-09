require "test_helper"

class ThredCreationTest < ActionDispatch::IntegrationTest
  def create_thred(ip, content, subject: "A new thred subject")
    post "/boards/w/threds",
         params: { subject: subject, content: content },
         as: :json,
         headers: { "X-Forwarded-For" => ip }
  end

  test "creates a thred with a valid opening post" do
    create_thred("198.51.100.20", "an opening post with enough words")

    assert_response :success

    thred = Thred.find(response.parsed_body["id"])
    assert_equal "an opening post with enough words", thred.posts.first.content
    assert_equal "Anonymous", thred.posts.first.author
  end

  test "stores the posting ip on the opening post" do
    create_thred("198.51.100.21", "an opening post with enough words")

    thred = Thred.find(response.parsed_body["id"])
    assert_equal "198.51.100.21", thred.posts.first.author_ip
  end

  test "rejects an opening post shorter than three words without an image" do
    create_thred("198.51.100.22", "too short")

    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "at least 3 words"
    assert_equal 0, Thred.where(subject: "A new thred subject").count
  end

  test "accepts a short opening post when an image url is attached" do
    post "/boards/w/threds",
         params: {
           subject: "A new thred subject",
           content: "ok",
           imageUrl: "https://example.com/a.png"
         },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.23" }

    assert_response :success
  end

  test "rejects a thred without a subject" do
    create_thred("198.51.100.24", "an opening post with enough words", subject: nil)

    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "Subject"
  end

  test "a second immediate thred from the same ip is refused with 429" do
    create_thred("198.51.100.25", "an opening post with enough words")
    assert_response :success

    create_thred("198.51.100.25", "another opening post with words")

    assert_response :too_many_requests
    assert_includes response.parsed_body["error"], "posting too quickly"
  end

  test "the thred cooldown does not block a different ip" do
    create_thred("198.51.100.26", "an opening post with enough words")
    assert_response :success

    create_thred("203.0.113.44", "another opening post with words")

    assert_response :success
  end
end
