import { Member, Role, TeamData, UserError } from './types';

const norm = (s: string) => s.toLowerCase().replaceAll('ё', 'е');
export class Team {
  members: Map<string, Member>;
  constructor(public data: TeamData) {
    if (!Array.isArray(data.members) || !Array.isArray(data.groups))
      throw new UserError('Ошибка site/team.json.');
    this.members = new Map(data.members.map((m) => [m.slug, m]));
    if (this.members.size !== data.members.length) throw new UserError('Повтор имени в team.json.');
    for (const m of data.members) {
      const seen = new Set([m.slug]);
      let current = m;
      while (current.lead_slug) {
        if (seen.has(current.lead_slug)) throw new UserError('Цикл руководителей в team.json.');
        seen.add(current.lead_slug);
        current = this.member(current.lead_slug);
      }
    }
  }
  member(slug: string) {
    const member = this.members.get(slug);
    if (!member)
      throw new UserError('Участник не найден в site/team.json. Сообщите администратору.');
    return member;
  }
  role(slug: string): Role {
    const m = this.member(slug),
      r = norm(m.role);
    if (r.includes('руководитель проекта') || r.includes('(pm)')) return 'project_manager';
    if (r.includes('tech lead') || r.includes('технический руководитель')) return 'tech_lead';
    return this.data.groups.some((g) => g.lead_slug === slug) ? 'lead' : 'participant';
  }
  special(role: Role) {
    const found = [...this.members.keys()].filter((s) => this.role(s) === role);
    if (found.length !== 1) throw new UserError('Не найден однозначный руководитель в team.json.');
    return found[0];
  }
  lead(slug: string) {
    const lead = this.member(slug).lead_slug || this.special('tech_lead');
    return this.role(lead) === 'project_manager' ? this.special('tech_lead') : lead;
  }
  scope(slug: string) {
    return [...this.members.keys()].filter(
      (s) =>
        ['tech_lead', 'project_manager'].includes(this.role(slug)) ||
        s === slug ||
        this.member(s).lead_slug === slug,
    );
  }
  suggest(text: string, author: string) {
    const t = norm(text);
    const found = [...this.members.values()].filter(
      (m) =>
        m.slug !== author &&
        (t.includes(m.slug) ||
          norm(m.name)
            .split(' ')
            .some((w) => w.length >= 6 && t.includes(w.slice(0, 6)))),
    );
    if (found.length === 1) return found[0].slug;
    const groups = this.data.groups.filter((g) =>
      norm(g.title)
        .split(/[^\p{L}\p{N}]+/u)
        .some((w) => w.length > 2 && t.includes(w)),
    );
    return groups.length === 1 ? groups[0].lead_slug : this.lead(author);
  }
}
