export interface MeetupRunningEvent {
    title: string
    link: string
    dateStr: string
}

export interface StrapiRunningEvent {
    title: string
    link: string
    dateStr: string
    id: number
    documentId: string
    createdAt?: string
    updatedAt?: string
    publishedAt?: string
}