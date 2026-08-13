import { http } from './http'
import type { ApiUpload } from './types'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // matches backend UPLOAD_MAX_SIZE_MB default (10MB)
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export class UploadValidationError extends Error {}

function validateImage(file: File) {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError(`File is too large (max ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB).`)
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new UploadValidationError('Unsupported image type. Use PNG, JPEG, WEBP, or GIF.')
  }
}

function validateAttachment(file: File) {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError(`File is too large (max ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB).`)
  }
}

export const uploadsApi = {
  uploadAvatar: (file: File) => {
    validateImage(file)
    const form = new FormData()
    form.append('file', file)
    return http.postForm<ApiUpload>('/uploads/avatar', form)
  },

  uploadCommunityIcon: (communityId: string, file: File) => {
    validateImage(file)
    const form = new FormData()
    form.append('file', file)
    return http.postForm<ApiUpload>(`/uploads/communities/${communityId}/icon`, form)
  },

  uploadAttachment: (file: File) => {
    validateAttachment(file)
    const form = new FormData()
    form.append('file', file)
    return http.postForm<ApiUpload>('/uploads/attachments', form)
  },
}
