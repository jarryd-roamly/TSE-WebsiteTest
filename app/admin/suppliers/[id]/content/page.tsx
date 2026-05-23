'use client'
import { useParams } from 'next/navigation'
import ContentCMS from './ContentCMS'

export default function SupplierContentPage() {
  const params = useParams()
  const supplierId = params?.id as string
  return <ContentCMS supplierId={supplierId} isAdmin={true} />
}
