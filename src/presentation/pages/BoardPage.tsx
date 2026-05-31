import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, MessageCircle, Pencil, Trash2, Loader2, X,
  ChevronDown, ChevronUp, Send, MessageSquare, Languages, ImageIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBoardStore, type Post } from '@/infrastructure/stores/boardStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { MediaUploader } from '@/presentation/components/MediaUploader'
import { MediaViewer } from '@/presentation/components/MediaViewer'
import { cn } from '@/lib/utils'
import { translateText } from '@/lib/translate'

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return t('notice.just_now')
  if (diff < 3600) return t('notice.minutes_ago', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('notice.hours_ago', { n: Math.floor(diff / 3600) })
  return t('notice.days_ago', { n: Math.floor(diff / 86400) })
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-rose-500', 'bg-teal-500', 'bg-orange-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', sz, getAvatarColor(name))}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── BoardPage ───────────────────────────────────────────────────────────────

export const BoardPage = () => {
  const { t, i18n } = useTranslation()
  const { user, isGuest } = useAuthStore()
  const {
    posts, loading, hasMore, comments, commentsLoading,
    loadPosts, addPost, updatePost, deletePost,
    loadComments, addComment, deleteComment,
  } = useBoardStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Post | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formMedia, setFormMedia] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deletePostId, setDeletePostId] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<{ commentId: string; postId: string } | null>(null)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [commentMedia, setCommentMedia] = useState<Record<string, string[]>>({})
  const [submittingComment, setSubmittingComment] = useState<string | null>(null)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())

  const commentInputRef = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { loadPosts(true) }, [loadPosts])

  const handleExpand = useCallback((postId: string) => {
    setExpandedId(prev => {
      if (prev === postId) return null
      if (!comments[postId]) loadComments(postId)
      return postId
    })
  }, [comments, loadComments])

  const openAdd = () => {
    setEditTarget(null)
    setFormTitle('')
    setFormContent('')
    setFormMedia([])
    setShowModal(true)
  }

  const openEdit = (post: Post) => {
    setEditTarget(post)
    setFormTitle(post.title)
    setFormContent(post.content)
    setFormMedia(post.mediaUrls ?? [])
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditTarget(null); setFormMedia([]) }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim() || !user) return
    setSaving(true)
    if (editTarget) {
      await updatePost(editTarget.id, formTitle.trim(), formContent.trim(), formMedia)
    } else {
      const post = await addPost(formTitle.trim(), formContent.trim(), user.id, user.inGameName, formMedia)
      if (post) setExpandedId(post.id)
    }
    setSaving(false)
    closeModal()
  }

  const handleDeletePost = async () => {
    if (!deletePostId) return
    setDeletingPostId(deletePostId)
    await deletePost(deletePostId)
    setDeletingPostId(null)
    setDeletePostId(null)
    if (expandedId === deletePostId) setExpandedId(null)
  }

  const handleAddComment = async (postId: string) => {
    const content = (commentInputs[postId] ?? '').trim()
    const media = commentMedia[postId] ?? []
    if ((!content && media.length === 0) || !user || submittingComment) return
    setSubmittingComment(postId)
    await addComment(postId, content, user.id, user.inGameName, media)
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    setCommentMedia(prev => ({ ...prev, [postId]: [] }))
    setSubmittingComment(null)
  }

  const handleTranslate = async (postId: string, content: string) => {
    if (translations.has(postId)) {
      setTranslations(prev => { const m = new Map(prev); m.delete(postId); return m })
      return
    }
    setTranslatingId(postId)
    try {
      const result = await translateText(content, i18n.language)
      setTranslations(prev => new Map(prev).set(postId, result))
    } catch {
      // silent
    } finally {
      setTranslatingId(null)
    }
  }

  const canEditPost = (post: Post) =>
    user?.role === 'ROLE_ADMIN' || user?.id === post.authorId
  const canDeleteComment = (authorId: string | null) =>
    user?.role === 'ROLE_ADMIN' || user?.id === authorId

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('board.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('board.subtitle', { count: posts.length })}
          </p>
        </div>
        {!isGuest && user && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('board.add_btn')}</span>
          </Button>
        )}
      </div>

      {/* 로딩 초기 */}
      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <MessageSquare className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('board.no_posts')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => {
            const isExpanded = expandedId === post.id
            const postComments = comments[post.id] ?? []
            const loadingComments = commentsLoading[post.id] ?? false

            return (
              <div
                key={post.id}
                className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] transition-colors"
              >
                {/* 게시글 헤더 (클릭으로 펼치기) */}
                <button
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                  onClick={() => handleExpand(post.id)}
                >
                  <Avatar name={post.authorName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {post.title}
                    </p>
                    {!isExpanded && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2 whitespace-pre-line">
                        {post.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-[var(--color-text-muted)]">{post.authorName}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(post.createdAt, t)}</span>
                      {post.updatedAt !== post.createdAt && (
                        <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">({t('notice.edited')})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {post.mediaUrls.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {post.mediaUrls.length}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.commentCount}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                      : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
                  </div>
                </button>

                {/* 펼쳐진 본문 */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border-subtle)]/60">
                    {/* 본문 내용 */}
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>

                      {/* 첨부 미디어 */}
                      {post.mediaUrls.length > 0 && (
                        <MediaViewer urls={post.mediaUrls} className="mt-3" />
                      )}

                      {/* 번역 결과 */}
                      {translations.has(post.id) && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]/60">
                          <p className="text-[10px] text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
                            <Languages className="w-3 h-3" /> {t('chat.translate_btn')}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                            {translations.get(post.id)}
                          </p>
                        </div>
                      )}

                      {/* 하단 액션 버튼 행 */}
                      <div className="flex items-center justify-between mt-3">
                        {/* 번역 버튼 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTranslate(post.id, post.content) }}
                          disabled={translatingId === post.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                        >
                          {translatingId === post.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Languages className="w-3 h-3" />}
                          {translations.has(post.id) ? t('common.close') : t('chat.translate_btn')}
                        </button>

                        {/* 수정 / 삭제 */}
                        {canEditPost(post) && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(post) }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> {t('common.edit')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletePostId(post.id) }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 댓글 섹션 */}
                    <div className="border-t border-[var(--color-border-subtle)]/60 bg-[var(--color-bg-base)]/50 rounded-b-xl">
                      <div className="px-4 py-3">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3">
                          {t('board.comment_count', { n: post.commentCount })}
                        </p>

                        {/* 댓글 목록 */}
                        {loadingComments ? (
                          <div className="flex items-center justify-center py-4 text-[var(--color-text-muted)]">
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            <span className="text-xs">{t('common.loading')}</span>
                          </div>
                        ) : postComments.length === 0 ? (
                          <p className="text-xs text-[var(--color-text-muted)] text-center py-3">{t('board.no_comments')}</p>
                        ) : (
                          <div className="space-y-3 mb-3">
                            {postComments.map((comment) => (
                              <div key={comment.id} className="flex items-start gap-2.5">
                                <Avatar name={comment.authorName} size="sm" />
                                <div className="flex-1 min-w-0 bg-[var(--color-bg-surface)] rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{comment.authorName}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-[var(--color-text-muted)]">{timeAgo(comment.createdAt, t)}</span>
                                      {canDeleteComment(comment.authorId) && (
                                        <button
                                          onClick={() => setDeleteCommentTarget({ commentId: comment.id, postId: post.id })}
                                          className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {comment.content && (
                                    <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{comment.content}</p>
                                  )}
                                  {comment.mediaUrls.length > 0 && (
                                    <MediaViewer urls={comment.mediaUrls} className="mt-2 !grid-cols-2" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 댓글 입력 */}
                        {!isGuest && user && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={user.inGameName} size="sm" />
                              <div className="flex-1 flex items-center gap-2">
                                <Input
                                  ref={(el) => { commentInputRef.current[post.id] = el }}
                                  value={commentInputs[post.id] ?? ''}
                                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id) } }}
                                  placeholder={t('board.comment_placeholder')}
                                  className="text-xs h-8"
                                />
                                <button
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={(!((commentInputs[post.id] ?? '').trim()) && (commentMedia[post.id]?.length ?? 0) === 0) || submittingComment === post.id}
                                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                                >
                                  {submittingComment === post.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                            {/* 댓글에도 사진/영상 첨부 (최대 2) */}
                            <div className="pl-8">
                              <MediaUploader
                                value={commentMedia[post.id] ?? []}
                                onChange={(urls) => setCommentMedia(prev => ({ ...prev, [post.id]: urls }))}
                                userId={user.id}
                                maxCount={2}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* 더 보기 */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => loadPosts()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('board.load_more')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {editTarget ? t('board.edit_title') : t('board.add_title')}
              </h2>
              <button onClick={closeModal} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('board.title_label')} *</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('board.title_placeholder')}
                  autoFocus
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('board.content_label')} *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('board.content_placeholder')}
                  rows={7}
                  className="w-full text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
                />
              </div>
              {/* 사진/동영상 첨부 (게시글당 최대 5개) */}
              {user && (
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('media.attachment')}</label>
                  <MediaUploader
                    value={formMedia}
                    onChange={setFormMedia}
                    userId={user.id}
                    maxCount={5}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={closeModal}>{t('common.cancel')}</Button>
              <Button
                size="full"
                onClick={handleSave}
                disabled={!formTitle.trim() || !formContent.trim() || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 게시글 삭제 확인 */}
      {deletePostId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('common.delete')}</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5 truncate max-w-[200px]">
                  {posts.find(p => p.id === deletePostId)?.title}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('board.delete_confirm')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletePostId(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deletingPostId === deletePostId}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingPostId === deletePostId
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 댓글 삭제 확인 */}
      {deleteCommentTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('board.comment_delete_confirm')}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteCommentTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  await deleteComment(deleteCommentTarget.commentId, deleteCommentTarget.postId)
                  setDeleteCommentTarget(null)
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
