import { Linkedin } from "lucide-react";
import type { TeamMember } from "@/data/entreprise-data";

export function TeamCard({ initials, name, role, bio, linkedinUrl, avatarGradient }: TeamMember) {
  return (
    <div className="text-center p-8 md:p-10 rounded-[20px] border border-border bg-white hover:shadow-xl hover:border-transparent hover:translate-y-[-4px] transition-all">
      <div className={`w-[120px] md:w-[140px] h-[120px] md:h-[140px] rounded-full mx-auto mb-5 bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-[36px] md:text-[40px] font-bold text-white`}>
        {initials}
      </div>
      <h3 className="text-xl font-bold text-[#1E293B] mb-1">{name}</h3>
      <p className="text-sm font-semibold text-[#E70866] mb-4">{role}</p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{bio}</p>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[#1B5BDA] text-sm font-semibold px-3.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <Linkedin className="w-4 h-4" /> LinkedIn
      </a>
    </div>
  );
}
