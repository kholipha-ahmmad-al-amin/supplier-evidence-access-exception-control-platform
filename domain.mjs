import { randomUUID } from 'node:crypto';

export const Roles = Object.freeze({ REQUESTER: 'exception_requester', ANALYST: 'risk_analyst', AUTHORITY: 'exception_authority', OWNER: 'control_owner', ASSURANCE: 'assurance_reviewer' });
export const Statuses = Object.freeze({ SUBMITTED: 'submitted', ASSESSED: 'assessed', AUTHORIZED: 'authorized', MITIGATED: 'mitigated', CLOSED: 'closed' });
export class DomainError extends Error { constructor(message, code = 'DOMAIN_RULE', statusCode = 422) { super(message); this.name = 'DomainError'; this.code = code; this.statusCode = statusCode; } }
const requiredText = (value, label) => { if (typeof value !== 'string' || !value.trim()) throw new DomainError(`${label} is required.`, 'VALIDATION_ERROR', 400); return value.trim(); };

export class ExceptionControlService {
  constructor({ cases = [], persist = async () => {}, now = () => new Date().toISOString() } = {}) { this.cases = structuredClone(cases); this.persist = persist; this.now = now; }
  list() { return structuredClone(this.cases); }
  get(id) { return structuredClone(this.#find(id)); }
  async submit(actor, input) {
    this.#role(actor, Roles.REQUESTER);
    const item = { id: randomUUID(), supplier: requiredText(input.supplier, 'supplier'), subjectId: requiredText(input.subjectId, 'subjectId'), requestedScope: requiredText(input.requestedScope, 'requestedScope'), businessJustification: requiredText(input.businessJustification, 'businessJustification'), status: Statuses.SUBMITTED, audit: [this.#event('exception_submitted', actor, {})] };
    this.cases.push(item); await this.persist({ cases: this.cases }); return this.get(item.id);
  }
  async assess(id, actor, input) { this.#role(actor, Roles.ANALYST); return this.#advance(id, Statuses.SUBMITTED, Statuses.ASSESSED, 'risk_assessed', actor, { assessmentReference: requiredText(input.assessmentReference, 'assessmentReference') }); }
  async authorize(id, actor, input) { this.#role(actor, Roles.AUTHORITY); return this.#advance(id, Statuses.ASSESSED, Statuses.AUTHORIZED, 'exception_authorized', actor, { expiryDate: requiredText(input.expiryDate, 'expiryDate') }); }
  async mitigate(id, actor, input) { this.#role(actor, Roles.OWNER); return this.#advance(id, Statuses.AUTHORIZED, Statuses.MITIGATED, 'compensating_control_confirmed', actor, { controlReference: requiredText(input.controlReference, 'controlReference') }); }
  async close(id, actor, input) { this.#role(actor, Roles.ASSURANCE); return this.#advance(id, Statuses.MITIGATED, Statuses.CLOSED, 'exception_closed', actor, { closureDecision: requiredText(input.closureDecision, 'closureDecision') }); }
  #find(id) { const item = this.cases.find((candidate) => candidate.id === id); if (!item) throw new DomainError('Exception case was not found.', 'NOT_FOUND', 404); return item; }
  #role(actor, role) { if (!actor?.id || actor.role !== role) throw new DomainError(`Only ${role} may perform this action.`, 'FORBIDDEN', 403); }
  async #advance(id, from, to, type, actor, detail) { const item = this.#find(id); if (item.status !== from) throw new DomainError(`Case must be ${from} before this action.`, 'INVALID_STATE'); item.status = to; item.audit.push(this.#event(type, actor, detail)); await this.persist({ cases: this.cases }); return this.get(item.id); }
  #event(type, actor, detail) { return { id: randomUUID(), type, actorId: actor.id, actorRole: actor.role, occurredAt: this.now(), detail }; }
}
