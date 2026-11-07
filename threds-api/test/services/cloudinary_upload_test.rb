require "test_helper"

class CloudinaryUploadTest < ActiveSupport::TestCase
  UploadedFileStub = Struct.new(:size, :content_type, :path)

  test "accepts images, WebM, and MP4 files smaller than 25 MB" do
    assert_nil CloudinaryUpload.validation_error(UploadedFileStub.new(1024, "image/gif"))
    assert_nil CloudinaryUpload.validation_error(UploadedFileStub.new(1024, "video/webm"))
    assert_nil CloudinaryUpload.validation_error(UploadedFileStub.new(1024, "video/mp4"))
  end

  test "rejects unsupported video formats" do
    error = CloudinaryUpload.validation_error(UploadedFileStub.new(1024, "video/quicktime"))

    assert_equal "Only image files, WebM videos, and MP4 videos are supported.", error
  end

  test "rejects invalid upload values" do
    assert_equal "Invalid media upload.", CloudinaryUpload.validation_error("not a file")
  end

  test "rejects files that are 25 MB or larger" do
    error = CloudinaryUpload.validation_error(
      UploadedFileStub.new(CloudinaryUpload::MAX_FILE_SIZE_BYTES, "video/webm")
    )

    assert_equal "Choose a file smaller than 25 MB.", error
  end

  test "uploads images and videos to their matching Cloudinary resource types" do
    [
      ["image/gif", :image],
      ["video/webm", :video],
      ["video/mp4", :video]
    ].each do |content_type, expected_resource_type|
      file = UploadedFileStub.new(1024, content_type, "/tmp/upload")
      Cloudinary::Uploader.stub :upload, ->(_path, options) {
        assert_equal expected_resource_type, options[:resource_type]
        { "secure_url" => "https://res.cloudinary.com/demo/uploaded" }
      } do
        assert_equal "https://res.cloudinary.com/demo/uploaded", CloudinaryUpload.call(file)
      end
    end
  end
end
