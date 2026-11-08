require "test_helper"
require "minitest/mock"

class SketchObjectsTest < ActionDispatch::IntegrationTest
  def create_object(thred, operation_id: "operation-1", headers: {}, data: nil)
    post "/threds/#{thred.id}/sketch/objects",
         params: {
           operationId: operation_id,
           type: "stroke",
           data: data || {
             points: [{ x: 10, y: 20 }, { x: 40, y: 60 }],
             color: "#111827",
             strokeWidth: 4
           }
         },
         as: :json,
         headers: headers
  end

  test "persists sketch operations and returns them when the canvas is loaded" do
    thred = threds(:"test-thred-1")

    create_object(thred)

    assert_response :created
    operation = response.parsed_body.fetch("operation")
    assert_equal "operation-1", operation["operationId"]
    assert_equal "stroke", operation["type"]
    assert_equal 2, operation.dig("data", "points").length
    assert_equal 1, thred.sketch_objects.count

    get "/threds/#{thred.id}/sketch"

    assert_response :success
    assert_equal [operation["id"]], response.parsed_body.fetch("objects").map { |item| item["id"] }
  end

  test "rejects invalid drawings and duplicate operation IDs with different data" do
    thred = threds(:"test-thred-1")
    create_object(thred, data: { points: [{ x: 4_001, y: 20 }], color: "#111827", strokeWidth: 4 })

    assert_response :unprocessable_entity

    create_object(thred)
    assert_response :created
    create_object(thred, data: { points: [{ x: 10, y: 20 }], color: "#dc2626", strokeWidth: 4 })

    assert_response :conflict
    assert_equal 1, thred.sketch_objects.count
  end

  test "retries with the same operation ID return the saved object without duplicating it" do
    thred = threds(:"test-thred-1")
    create_object(thred)
    first_id = response.parsed_body.dig("operation", "id")

    create_object(thred)

    assert_response :ok
    assert_equal first_id, response.parsed_body.dig("operation", "id")
    assert_equal 1, thred.sketch_objects.count
  end

  test "image revisions can replace an existing image but cannot reference a non-image object" do
    thred = threds(:"test-thred-1")
    post "/threds/#{thred.id}/sketch/objects",
         params: {
           operationId: "image-operation-1",
           type: "image",
           data: { url: "https://cloudinary.example/image.png", x: 100, y: 100, width: 700, height: 560 }
         },
         as: :json
    assert_response :created

    post "/threds/#{thred.id}/sketch/objects",
         params: {
           operationId: "image-operation-2",
           type: "image",
           data: {
             url: "https://cloudinary.example/image.png",
             x: 300,
             y: 100,
             width: 700,
             height: 560,
             supersedesOperationId: "image-operation-1"
           }
         },
         as: :json
    assert_response :created

    post "/threds/#{thred.id}/sketch/objects",
         params: {
           operationId: "image-operation-3",
           type: "image",
           data: {
             url: "https://cloudinary.example/image.png",
             x: 300,
             y: 100,
             width: 700,
             height: 560,
             supersedesOperationId: "unknown-operation"
           }
         },
         as: :json
    assert_response :unprocessable_entity
    assert_equal 2, thred.sketch_objects.count
  end

  test "keyed threads require the existing key for sketch edits" do
    thred = create_keyed_thred

    get "/threds/#{thred.id}/sketch"
    assert_response :success

    create_object(thred)
    assert_response :forbidden

    create_object(thred, headers: { "X-Thred-Key" => "incorrect-key" })
    assert_response :forbidden

    create_object(thred, headers: { "X-Thred-Key" => "secret" })
    assert_response :created
  end

  test "keyed threads require the existing key for clipboard image uploads" do
    thred = create_keyed_thred
    file = Rack::Test::UploadedFile.new(StringIO.new("image bytes"), "image/png", original_filename: "clipboard.png")

    post "/upload", params: { file: file, thread_id: thred.id }
    assert_response :forbidden

    file = Rack::Test::UploadedFile.new(StringIO.new("image bytes"), "image/png", original_filename: "clipboard.png")
    CloudinaryUpload.stub :call, "https://cloudinary.example/clipboard.png" do
      post "/upload",
           params: { file: file, thread_id: thred.id },
           headers: { "X-Thred-Key" => "secret" }
    end

    assert_response :ok
    assert_equal "https://cloudinary.example/clipboard.png", response.parsed_body["imageUrl"]
  end

  test "deleting a thread deletes its sketch records" do
    thred = threds(:"test-thred-1")
    create_object(thred)

    thred.destroy!

    assert_equal 0, SketchObject.where(thred_id: thred.id).count
  end

  private

  def create_keyed_thred
    thred = Thred.new(
      id: SecureRandom.uuid,
      board_type: "s",
      subject: "A keyed sketch",
      protection_status: "code_protected",
      timestamp: 2
    )
    thred.set_thread_code("secret")
    thred.save!
    thred
  end
end

class SketchObjectBroadcastTest < ActionDispatch::IntegrationTest
  include ActionCable::TestHelper

  self.use_transactional_tests = false

  test "completed drawings are broadcast to Action Cable subscribers" do
    thred = threds(:"test-thred-1")

    assert_broadcasts("sketch:#{thred.id}", 1) do
      post "/threds/#{thred.id}/sketch/objects",
           params: {
             operationId: "broadcast-operation",
             type: "line",
             data: { x1: 10, y1: 20, x2: 40, y2: 60, color: "#111827", strokeWidth: 4 }
           },
           as: :json
    end

    assert_response :created
  ensure
    SketchObject.delete_all
  end
end
