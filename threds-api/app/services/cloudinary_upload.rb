class CloudinaryUpload
  def self.call(file)
    return nil unless file.present?

    begin
      result = Cloudinary::Uploader.upload(
        file.path,
        resource_type: :auto,
        folder: "threds"
      )
      result["secure_url"]
    rescue => e
      Rails.logger.error("Cloudinary upload failed: #{e.message}")
      nil
    end
  end
end
