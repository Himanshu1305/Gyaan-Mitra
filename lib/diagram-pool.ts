import { createClient } from '@supabase/supabase-js'
import chapterTopicsConfig from '../config/chapter-topics.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface DiagramImage {
  id: number
  topic_key: string
  image_url: string
  source_url: string
  variant: string
  usage_count: number
}

// Get all approved images for given topic keys
// Returns map of topic_key -> array of DiagramImage
export async function getAvailableTopicImages(
  topicKeys: string[]
): Promise<Record<string, DiagramImage[]>> {
  if (!topicKeys.length) return {}

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('diagram_pool')
    .select('id, topic_key, image_url, source_url, variant, usage_count')
    .in('topic_key', topicKeys)
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('usage_count', { ascending: true })

  if (error) {
    console.error('[diagram-pool] Error fetching images:', error.message)
    return {}
  }

  const result: Record<string, DiagramImage[]> = {}
  for (const row of data || []) {
    if (!result[row.topic_key]) result[row.topic_key] = []
    result[row.topic_key].push(row as DiagramImage)
  }
  return result
}

// Get topics available for a specific chapter from config
export function getChapterTopics(
  classNumber: number,
  subject: string,
  chapterNumber: number
): string[] {
  try {
    const config = chapterTopicsConfig as Record<string, Record<string, Record<string, { topics: string[] }>>>
    return config?.[classNumber]?.[subject]?.[chapterNumber]?.topics || []
  } catch {
    return []
  }
}

// Select one image randomly from available images for a topic
export function selectImage(images: DiagramImage[]): DiagramImage | null {
  if (!images || images.length === 0) return null
  return images[Math.floor(Math.random() * images.length)]
}

// Log a missing diagram topic request
export async function logMissingDiagram(
  topicKey: string,
  classNumber: number,
  subject: string,
  chapterNumber: number
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    await supabase.rpc('upsert_missing_diagram', {
      p_topic_key: topicKey,
      p_topic_name: topicKey.replace(/_/g, ' '),
      p_class_number: classNumber,
      p_subject: subject,
      p_chapter_number: chapterNumber
    })
  } catch (err) {
    console.error('[diagram-pool] Error logging missing diagram:', err)
  }
}

// Record image usage after paper generation
export async function recordImageUsage(
  paperId: string,
  topicKey: string,
  imageId: number,
  classNumber: number,
  subject: string
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase.from('diagram_usage').insert({
      paper_id: paperId,
      diagram_pool_id: imageId,
      topic_key: topicKey,
      class_number: classNumber,
      subject: subject
    })

    // Increment usage count
    await supabase.rpc('increment_diagram_usage', { p_id: imageId })
  } catch (err) {
    console.error('[diagram-pool] Error recording usage:', err)
  }
}

// Build the available diagrams text for Claude prompt
export function buildAvailableDiagramsPrompt(
  availableImages: Record<string, DiagramImage[]>
): string {
  const topics = Object.keys(availableImages)
  if (topics.length === 0) {
    return 'AVAILABLE DIAGRAM TOPICS: None. Do not generate any diagram-based questions.'
  }

  const lines = topics.map(key => {
    const images = availableImages[key]
    const variants = Array.from(new Set(images.map(i => i.variant))).join(', ')
    const topicName = key.replace(/_/g, ' ')
    return `  - ${key}: ${topicName} (${images.length} image(s), variants: ${variants})`
  })

  return `AVAILABLE DIAGRAM TOPICS FOR THIS PAPER:
You may ONLY create diagram-based questions using these exact topic keys.
Insert marker [DIAGRAM:topic_key] on the line immediately before the question text.

${lines.join('\n')}

STRICT RULES FOR DIAGRAMS:
1. ONLY use topic_key values from the list above — no other diagram topics allowed
2. NEVER create a diagram question for a topic not in this list
3. Place [DIAGRAM:topic_key] on its own line immediately before the question
4. Maximum 1 diagram per question
5. NEVER place [DIAGRAM:] markers on questions asking students to DRAW a diagram
6. If you want a diagram question but the topic is not available, write a non-diagram question instead
7. Do not invent or guess topic keys — use ONLY the keys listed above exactly as written`
}
