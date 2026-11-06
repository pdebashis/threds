require "test_helper"

class GridTest < ActionDispatch::IntegrationTest
  def create_grid(subject: "A test Grid", access: "public", access_key: nil)
    post "/grid/items",
         params: { subject: subject, access: access, accessKey: access_key }.compact,
         as: :json
  end

  test "creates and lists Grid items without exposing key material" do
    create_grid(subject: "A stored Grid")

    assert_response :created
    item = response.parsed_body
    assert_equal "A stored Grid", item["subject"]
    assert_equal "public", item["access"]
    assert_equal 0, item["postCount"]

    get "/grid/items"
    assert_response :success
    assert_includes response.parsed_body.map { |entry| entry["id"] }, item["id"]
    refute response.body.include?("keyDigest")
    refute response.body.include?("keySalt")
  end

  test "creates keyed Grid items with a hashed key" do
    create_grid(access: "keyed", access_key: "a secure grid key")

    assert_response :created
    item = GridItem.find(response.parsed_body["id"])
    assert_equal "keyed", item.access
    assert_not_equal "a secure grid key", item.key_digest
    assert item.accepts_access_key?("a secure grid key")
    refute response.body.include?("keyDigest")
  end

  test "rejects a keyed Grid without a valid key" do
    create_grid(access: "keyed", access_key: "short")

    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "between 8 and 200 characters"
  end

  test "stores posts and format separately and returns populated cells" do
    create_grid
    item_id = response.parsed_body["id"]

    post "/grid/items/#{item_id}/cells/2/3/posts",
         params: { content: "first cell post" },
         as: :json
    assert_response :created
    assert_equal 1, response.parsed_body.dig("cell", "postCount")

    patch "/grid/items/#{item_id}/cells/2/3/format",
          params: { bold: true, color: "amber" },
          as: :json
    assert_response :success
    assert_equal({ "bold" => true, "color" => "amber" }, response.parsed_body.dig("cell", "format"))

    get "/grid/items/#{item_id}/cells",
        params: { rowStart: 1, rowEnd: 10, columnStart: 1, columnEnd: 10 }
    assert_response :success
    cells = response.parsed_body["cells"]
    assert_equal 1, cells.length
    assert_equal "first cell post", cells.first.dig("posts", 0, "content")

    get "/grid/items"
    listed_item = response.parsed_body.find { |entry| entry["id"] == item_id }
    assert_equal 1, listed_item["postCount"]
    assert_equal 1, listed_item["populatedCells"]
  end

  test "clearing format removes a format-only cell" do
    create_grid
    item_id = response.parsed_body["id"]

    patch "/grid/items/#{item_id}/cells/1/1/format",
          params: { bold: true, color: nil },
          as: :json
    assert_response :success
    assert_not_nil response.parsed_body["cell"]

    patch "/grid/items/#{item_id}/cells/1/1/format",
          params: { bold: false, color: nil },
          as: :json
    assert_response :success
    assert_nil response.parsed_body["cell"]
  end

  test "keyed Grid writes require the matching key" do
    create_grid(access: "keyed", access_key: "a secure grid key")
    item_id = response.parsed_body["id"]

    post "/grid/items/#{item_id}/cells/1/1/posts",
         params: { content: "unauthorized" },
         as: :json
    assert_response :forbidden

    post "/grid/items/#{item_id}/cells/1/1/posts",
         params: { content: "authorized" },
         as: :json,
         headers: { "X-Grid-Access-Key" => "a secure grid key" }
    assert_response :created
  end

  test "rejects invalid coordinates, colors, and blank posts" do
    create_grid
    item_id = response.parsed_body["id"]

    post "/grid/items/#{item_id}/cells/501/1/posts",
         params: { content: "outside bounds" },
         as: :json
    assert_response :unprocessable_entity

    post "/grid/items/#{item_id}/cells/1/1/posts",
         params: { content: " " },
         as: :json
    assert_response :unprocessable_entity

    patch "/grid/items/#{item_id}/cells/1/1/format",
          params: { bold: false, color: "invalid" },
          as: :json
    assert_response :unprocessable_entity
  end
end
