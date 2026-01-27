import InterviewWrapper from "@/components/InterviewWrapper";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <InterviewWrapper interviewId={id} />;
}
