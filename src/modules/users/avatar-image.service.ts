/**
 * Compatibility export for clients that imported the avatar sanitizer from the users module.
 * Avatar implementation now belongs to the optional user-avatars capability.
 */
export { AvatarImageService, assertSafeAvatarMetadata } from '@/modules/user-avatars';
