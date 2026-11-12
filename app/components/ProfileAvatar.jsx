'use client';

// Profile photo: a square (no rounding, like the rest of the app) with the photo, or the username's first letter on
// grey when there is none. The photo is a small JPEG data URL kept in settings.profilePhoto (local + cloud), so
// friends see it on their copy of your profile.

import React from 'react';

/** Reads an image file and returns a centre-cropped `size` × `size` JPEG data URL (≈ 10–20 KB at 192 px). */
export const resizeImageFileToDataUrl = (file, size = 192) =>
  new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('That file is not an image.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });

/** Only our own small JPEG / PNG data URLs are shown (never a remote URL from someone's settings). */
export const isProfilePhoto = value =>
  typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length < 400000;

export function ProfileAvatar({ photo, username = '', size = 56, style }) {
  const letter = String(username || '?').replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2A2A2A',
        border: 'none', borderRadius: '10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: '#9A9A9A',
        fontSize: `${Math.round(size * 0.45)}px`,
        fontWeight: 500,
        ...style
      }}
    >
      {isProfilePhoto(photo) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        letter
      )}
    </span>
  );
}

export default ProfileAvatar;
