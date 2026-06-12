---

## 8. API Tags & Complete Contract Reference

This guide focuses on ownership APIs. For the complete contract, refer to the OpenAPI documentation organized by **semantic tag**:

| Tag | Relevant Sections | Reference |
|-----|-------------------|-----------|
| **Ship** | Ship list, ship ownership, ship transfer, salvage, piracy | `api/openapi/ship/openapi.yaml` |
| **Items** | Item ownership, item list by owner | `api/openapi/items/openapi.yaml` |
| **Market** | Market listings, offers, ownership validation | `api/openapi/market/openapi.yaml` |
| **Character** | Character management, ownership context | `api/openapi/character/openapi.yaml` |
| **Auth** | Session establishment for ownership-scoped queries | `api/openapi/auth/openapi.yaml` |
| **Bust** | NPC ownership model, NPC customization | `api/openapi/bust/openapi.yaml` |

### Complete API Reference

- **OpenAPI Spec (Master):** `api/openapi.yaml` — single source of truth for all endpoints (version 3.1.0)
- **Interactive Docs:** `GET http://localhost:3000/docs` — Swagger UI powered by main spec
- **Modular Documentation:** `api/openapi/{tag-name}/openapi.yaml` — tag-specific references for focused learning
- **Backend Guide:** `CODEBASE.md` — implementation details, database layer, event flow

### Testing Ownership APIs

When implementing ownership features in Nova, reference:
1. The migration checklist (section 7) for implementation order
2. The appropriate tag module (section 8 above) for endpoint definitions
3. `test/server-*.test.js` in the backend for example payloads and error cases
4. `docs/planning/ownership/ownership-contract-formalization-plan.md` for architectural decisions
