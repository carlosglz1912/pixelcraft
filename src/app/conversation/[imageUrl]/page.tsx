import { ImageConversation } from '@/components/features/image-conversation'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ imageUrl: string }>
}) {
  const { imageUrl } = await params

  return <ImageConversation initialImageUrl={decodeURIComponent(imageUrl)} />
}
