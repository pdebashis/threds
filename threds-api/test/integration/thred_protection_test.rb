require "test_helper"

class ThredProtectionTest < ActionDispatch::IntegrationTest
  test "existing threds default to public" do
    thred = threds(:"test-thred-1")

    assert_equal "public", thred.protection_status
    get "/threds/#{thred.id}"

    assert_response :success
    assert_equal "public", response.parsed_body["protectionStatus"]
  end

  test "creates a keyed thred without returning its key digest" do
    post "/boards/w/threds",
         params: {
           subject: "A keyed thred",
           content: "an opening post with enough words",
           protectionStatus: "code_protected",
           threadCode: "a-secure-thred-key"
         },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.40" }

    assert_response :success
    thred = Thred.find(response.parsed_body["id"])
    assert_equal "code_protected", thred.protection_status
    assert_not_equal "a-secure-thred-key", thred.thread_code_digest
    assert_nil response.parsed_body["threadCode"]
    assert_nil response.parsed_body["threadCodeDigest"]
  end

  test "creates a keyed thred with a one-character key" do
    post "/boards/w/threds",
         params: {
           subject: "A keyed thred",
           content: "an opening post with enough words",
           protectionStatus: "code_protected",
           threadCode: "x"
         },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.41" }

    assert_response :success
    thred = Thred.find(response.parsed_body["id"])
    assert thred.accepts_post_key?("x")
  end

  test "rejects a keyed thred with a blank key" do
    post "/boards/w/threds",
         params: {
           subject: "A keyed thred",
           content: "an opening post with enough words",
           protectionStatus: "code_protected",
           threadCode: ""
         },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.45" }

    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "can't be blank"
  end

  test "only the correct key can add a post to a keyed thred" do
    thred = Thred.new(
      id: SecureRandom.uuid,
      board_type: "w",
      subject: "A keyed thred",
      protection_status: "code_protected",
      timestamp: 1
    )
    thred.set_thread_code("a-secure-thred-key")
    thred.save!

    post "/threds/#{thred.id}/posts",
         params: { content: "a reply with enough words" },
         as: :json,
         headers: { "X-Forwarded-For" => "198.51.100.42" }

    assert_response :forbidden

    post "/threds/#{thred.id}/posts",
         params: { content: "a reply with enough words" },
         as: :json,
         headers: {
           "X-Forwarded-For" => "198.51.100.43",
           "X-Thred-Key" => "incorrect-thred-key"
         }

    assert_response :forbidden

    post "/threds/#{thred.id}/posts",
         params: { content: "a reply with enough words" },
         as: :json,
         headers: {
           "X-Forwarded-For" => "198.51.100.44",
           "X-Thred-Key" => "a-secure-thred-key"
         }

    assert_response :success
    assert_equal 1, thred.posts.count
  end
end
