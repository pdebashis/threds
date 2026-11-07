class SketchObjectsController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  def index
    thred = Thred.find(params[:id])
    render json: { objects: thred.sketch_objects.order(:created_at, :id).map(&:as_json) }
  end

  def create
    thred = Thred.find(params[:id])
    unless thred.accepts_post_key?(request.headers["X-Thred-Key"])
      return render json: { error: "A valid thred key is required to edit this sketch" }, status: :forbidden
    end

    operation_id = params[:operationId].to_s
    existing = thred.sketch_objects.find_by(operation_id: operation_id)
    if existing
      return render_existing_operation(existing)
    end

    object = thred.sketch_objects.new(
      id: SecureRandom.uuid,
      operation_id: operation_id,
      object_type: params[:type],
      data: operation_data
    )

    unless object.save
      return render json: { error: object.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    render json: { operation: object.as_json }, status: :created
  rescue ActiveRecord::RecordNotUnique
    existing = thred.sketch_objects.find_by!(operation_id: operation_id)
    render_existing_operation(existing)
  end

  private

  def operation_data
    raw_data = params[:data]
    return {} unless raw_data.is_a?(ActionController::Parameters) || raw_data.is_a?(Hash)

    raw_data.to_unsafe_h.deep_stringify_keys
  end

  def render_existing_operation(existing)
    if existing.object_type == params[:type].to_s && existing.data == operation_data
      render json: { operation: existing.as_json }, status: :ok
    else
      render json: { error: "Operation ID has already been used for a different sketch object" }, status: :conflict
    end
  end
end
