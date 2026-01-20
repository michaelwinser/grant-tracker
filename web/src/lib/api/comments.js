/**
 * Google Drive Comments API wrapper module.
 * Fetches assigned comments from Google Docs for action item sync.
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Extract file ID from a Google Docs URL.
 * Supports various URL formats (docs.google.com/document/d/ID/...)
 * @param {string} url - Google Docs URL
 * @returns {string|null} - File ID or null if not found
 */
export function extractFileIdFromUrl(url) {
  if (!url) return null;

  // Match various Google Docs/Drive URL patterns
  // https://docs.google.com/document/d/FILE_ID/edit
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch all comments from a file.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<Object[]>} - Array of comment objects
 */
export async function fetchComments(accessToken, fileId) {
  const params = new URLSearchParams({
    fields: 'comments(id,content,author,createdTime,resolved,replies,anchor)',
    pageSize: '100',
  });

  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}/comments?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to fetch comments (${response.status})`
    );
  }

  const data = await response.json();
  return data.comments || [];
}

/**
 * Fetch assigned comments from a file (both resolved and unresolved).
 * Google Docs native assignment appears in the content as a task.
 * We look for comments that have an anchor and check for task assignment.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - Google Drive file ID
 * @param {Object} options - Options
 * @param {boolean} options.includeResolved - Include resolved comments (default: false)
 * @returns {Promise<Object[]>} - Array of assigned comment objects with normalized fields
 */
export async function fetchAssignedComments(accessToken, fileId, { includeResolved = false } = {}) {
  // Fetch with additional fields for task/assignment detection
  const params = new URLSearchParams({
    fields: 'comments(id,content,author(displayName,emailAddress),createdTime,resolved,quotedFileContent,anchor)',
    pageSize: '100',
  });

  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}/comments?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to fetch comments (${response.status})`
    );
  }

  const data = await response.json();
  const comments = data.comments || [];

  // Filter and normalize assigned comments
  // Google Docs assignments show up with specific patterns in content
  // Look for comments with @mentions that indicate assignments
  const assignedComments = [];

  for (const comment of comments) {
    // Skip resolved comments unless explicitly requested
    if (comment.resolved && !includeResolved) continue;

    // Parse the content for assignment patterns
    const parsed = parseAssignment(comment.content);
    if (parsed.assignee) {
      assignedComments.push({
        id: comment.id,
        content: parsed.content,
        assignee: parsed.assignee,
        author: comment.author?.emailAddress || comment.author?.displayName,
        createdTime: comment.createdTime,
        quotedText: comment.quotedFileContent?.value || null,
        resolved: comment.resolved || false,
        // Construct direct link to comment
        htmlLink: `https://docs.google.com/document/d/${fileId}/edit?disco=${comment.id}`,
      });
    }
  }

  return assignedComments;
}

/**
 * Parse comment content for assignment patterns.
 * Google Docs uses "_Assigned to @email" suffix for assigned tasks.
 * We also detect manual patterns like "@email" or "+email" at the start.
 * @param {string} content - Comment content
 * @returns {{content: string, assignee: string|null}}
 */
function parseAssignment(content) {
  if (!content) return { content: '', assignee: null };

  // Pattern 1: Google Docs native assignment
  // Format: "Comment text_Assigned to person@email.com"
  const nativeAssignMatch = content.match(/_Assigned to ([^\s]+@[^\s]+)$/);
  if (nativeAssignMatch) {
    return {
      content: content.replace(/_Assigned to [^\s]+@[^\s]+$/, '').trim(),
      assignee: nativeAssignMatch[1],
    };
  }

  // Pattern 2: @mention at the start (manual convention)
  // Format: "@person@email.com: Task description"
  const atMentionMatch = content.match(/^@([^\s:]+@[^\s:]+):?\s*(.*)$/s);
  if (atMentionMatch) {
    return {
      content: atMentionMatch[2].trim() || content,
      assignee: atMentionMatch[1],
    };
  }

  // Pattern 3: +mention (another convention)
  // Format: "+person@email.com Task description"
  const plusMentionMatch = content.match(/^\+([^\s]+@[^\s]+)\s+(.*)$/s);
  if (plusMentionMatch) {
    return {
      content: plusMentionMatch[2].trim(),
      assignee: plusMentionMatch[1],
    };
  }

  // No assignment found
  return { content, assignee: null };
}

/**
 * Generate a unique sync ID for deduplication.
 * @param {string} fileId - Google Drive file ID
 * @param {string} commentId - Comment ID
 * @returns {string} - Sync ID in format "fileId:commentId"
 */
export function generateSyncId(fileId, commentId) {
  return `${fileId}:${commentId}`;
}

/**
 * Parse a sync ID into its components.
 * @param {string} syncId - Sync ID in format "fileId:commentId"
 * @returns {{fileId: string, commentId: string}|null}
 */
export function parseSyncId(syncId) {
  if (!syncId) return null;
  const [fileId, commentId] = syncId.split(':');
  if (!fileId || !commentId) return null;
  return { fileId, commentId };
}
