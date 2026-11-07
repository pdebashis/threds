class CloudinaryUpload
  MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

  def self.validation_error(file)
    return "Invalid media upload." unless file.respond_to?(:size) && file.respond_to?(:content_type)
    return "Choose a file smaller than 25 MB." if file.size >= MAX_FILE_SIZE_BYTES

    content_type = file.content_type.to_s.downcase
    unless content_type.start_with?("image/") || %w[video/webm video/mp4].include?(content_type)
      return "Only image files, WebM videos, and MP4 videos are supported."
    end

    nil
  end

  def self.call(file)
    return nil unless file.present?

    begin
      result = Cloudinary::Uploader.upload(
        file.path,
        resource_type: file.content_type.to_s.downcase.start_with?("video/") ? :video : :image,
        folder: "threds"
      )
      result["secure_url"]
    rescue => e
      Rails.logger.error("Cloudinary upload failed: #{e.message}")
      nil
    end
  end
end
