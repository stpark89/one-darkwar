import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Post {
  id: string
  title: string
  content: string
  authorId: string | null
  authorName: string
  commentCount: number
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
}

export interface PostComment {
  id: string
  postId: string
  content: string
  authorId: string | null
  authorName: string
  mediaUrls: string[]
  createdAt: string
}

const PAGE_SIZE = 20

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPost = (r: any): Post => ({
  id: r.id,
  title: r.title,
  content: r.content,
  authorId: r.author_id ?? null,
  authorName: r.author_name,
  commentCount: Number(r.post_comments?.[0]?.count ?? 0),
  mediaUrls: r.media_urls ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toComment = (r: any): PostComment => ({
  id: r.id,
  postId: r.post_id,
  content: r.content,
  authorId: r.author_id ?? null,
  authorName: r.author_name,
  mediaUrls: r.media_urls ?? [],
  createdAt: r.created_at,
})

interface BoardStore {
  posts: Post[]
  loading: boolean
  initialized: boolean
  hasMore: boolean
  comments: Record<string, PostComment[]>
  commentsLoading: Record<string, boolean>

  loadPosts: (reset?: boolean, force?: boolean) => Promise<void>
  addPost: (title: string, content: string, authorId: string, authorName: string, mediaUrls?: string[]) => Promise<Post | null>
  updatePost: (id: string, title: string, content: string, mediaUrls?: string[]) => Promise<void>
  deletePost: (id: string) => Promise<void>
  loadComments: (postId: string) => Promise<void>
  addComment: (postId: string, content: string, authorId: string, authorName: string, mediaUrls?: string[]) => Promise<void>
  deleteComment: (commentId: string, postId: string) => Promise<void>
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  posts: [],
  loading: false,
  initialized: false,
  hasMore: true,
  comments: {},
  commentsLoading: {},

  loadPosts: async (reset = false, force = false) => {
    // 첫 로드(reset=true)이고 이미 초기화된 상태면 skip — 페이지간 중복 호출 방지
    // 페이지네이션(reset=false)은 항상 실행, force=true 면 강제 새로고침
    if (reset && !force && get().initialized) return
    set({ loading: true })
    try {
      const offset = reset ? 0 : get().posts.length
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_comments(count)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) { console.error('[boardStore] loadPosts:', error); return }
      const newPosts = (data ?? []).map(toPost)
      set(s => ({
        posts: reset ? newPosts : [...s.posts, ...newPosts],
        hasMore: newPosts.length === PAGE_SIZE,
        initialized: true,
      }))
    } catch (err) {
      console.error('[boardStore] loadPosts exception:', err)
    } finally {
      set({ loading: false })
    }
  },

  addPost: async (title, content, authorId, authorName, mediaUrls = []) => {
    const { data, error } = await supabase
      .from('posts')
      .insert({ title, content, author_id: authorId, author_name: authorName, media_urls: mediaUrls })
      .select('*, post_comments(count)')
      .single()
    if (error || !data) { console.error('[boardStore] addPost:', error); return null }
    const post = toPost(data)
    set(s => ({ posts: [post, ...s.posts] }))
    return post
  },

  updatePost: async (id, title, content, mediaUrls) => {
    const payload: Record<string, unknown> = {
      title, content, updated_at: new Date().toISOString(),
    }
    if (mediaUrls !== undefined) payload.media_urls = mediaUrls
    const { data, error } = await supabase
      .from('posts')
      .update(payload)
      .eq('id', id)
      .select('*, post_comments(count)')
      .single()
    if (error || !data) { console.error('[boardStore] updatePost:', error); return }
    set(s => ({ posts: s.posts.map(p => p.id === id ? toPost(data) : p) }))
  },

  deletePost: async (id) => {
    await supabase.from('posts').delete().eq('id', id)
    set(s => ({
      posts: s.posts.filter(p => p.id !== id),
      comments: Object.fromEntries(Object.entries(s.comments).filter(([k]) => k !== id)),
    }))
  },

  loadComments: async (postId) => {
    if (get().commentsLoading[postId]) return
    set(s => ({ commentsLoading: { ...s.commentsLoading, [postId]: true } }))
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (error) { console.error('[boardStore] loadComments:', error); return }
      const loaded = (data ?? []).map(toComment)
      set(s => ({
        comments: { ...s.comments, [postId]: loaded },
        posts: s.posts.map(p => p.id === postId ? { ...p, commentCount: loaded.length } : p),
      }))
    } finally {
      set(s => ({ commentsLoading: { ...s.commentsLoading, [postId]: false } }))
    }
  },

  addComment: async (postId, content, authorId, authorName, mediaUrls = []) => {
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, content, author_id: authorId, author_name: authorName, media_urls: mediaUrls })
      .select()
      .single()
    if (error || !data) { console.error('[boardStore] addComment:', error); return }
    const comment = toComment(data)
    set(s => ({
      comments: { ...s.comments, [postId]: [...(s.comments[postId] ?? []), comment] },
      posts: s.posts.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p),
    }))
  },

  deleteComment: async (commentId, postId) => {
    await supabase.from('post_comments').delete().eq('id', commentId)
    set(s => ({
      comments: {
        ...s.comments,
        [postId]: (s.comments[postId] ?? []).filter(c => c.id !== commentId),
      },
      posts: s.posts.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p),
    }))
  },
}))
