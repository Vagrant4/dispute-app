# SKILL.md

## Skill: Fast MVP Build

Use this workflow for every feature:

1. Inspect existing files
2. Check schema impact
3. Add backend model/route/service
4. Add frontend page/component
5. Add validation
6. Add basic test
7. Run build/test
8. Fix errors before moving on

Do not rewrite the full app unless necessary.

## Skill: Evidence-First Product Decisions

For unclear requirements, prioritize the feature that best supports:
- Proof of work
- Time dispute evidence
- Salary claim evidence
- Progress claim evidence

## Skill: Report Generation

Progress claim reports must:
- Use snapshot JSON
- Include work logs
- Include photo evidence
- Include rate calculation
- Be exportable to PDF and CSV
- Remain unchanged after source records are edited

## Skill: Calculation Safety

All time/pay calculations must live in reusable utility functions.

Do not calculate pay directly inside UI components.

Test:
- total hours
- overtime hours
- basic pay
- OT pay
- gross pay
- net pay
