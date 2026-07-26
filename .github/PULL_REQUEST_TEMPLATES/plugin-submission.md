# Plugin Submission to Axolotl Repository

## Thank you for submitting your plugin!

Before we can review your submission, please complete this form.

---

## Plugin Information

### Plugin Name
<!-- e.g., TopStats -->

### Short Description
<!-- One sentence describing what your plugin does -->

### Upstream Repository
<!-- https://github.com/username/repo -->

### Target Branch
<!-- Usually 'main' -->

---

## Checklist

- [ ] I have read the [Review Policy](https://github.com/axolotl-pm/axolotl-plugin-repository/blob/main/docs/REVIEW_POLICY.md)
- [ ] I have read the [Submission Guide](https://github.com/axolotl-pm/axolotl-plugin-repository/blob/main/docs/SUBMISSION.md)
- [ ] My code is my own work OR I have proper licensing for dependencies
- [ ] Repository URL and branch are correct
- [ ] I understand **human review is required** before publication
- [ ] I understand **only the reviewed exact commit** will be used
- [ ] I understand CI passing does NOT mean my plugin is approved
- [ ] My `plugin.yml` is valid and in the repository root

---

## Security Acknowledgment

By submitting this plugin, I acknowledge that:

1. A human reviewer will examine the exact code at the approved commit SHA
2. The reviewer may request changes
3. My plugin will be built by Axolotl infrastructure from preserved source
4. If approved, the exact reviewed commit will be preserved and built
5. Human review **reduces risk** but does **not guarantee** the plugin is safe
6. New versions require new review - updates are not automatic

---

## Additional Notes

<!-- Any other information reviewers should know about your plugin -->

---

## For Reviewer Use

### Automated Validation Results
<!-- To be filled by CI -->

- [ ] Repository accessible
- [ ] plugin.yml valid
- [ ] Build feasible
- [ ] No critical security patterns

### Exact SHA Under Review
<!-- To be filled by CI or reviewer -->
<!-- Must be explicit 40-character SHA -->

### Human Review
<!-- To be filled by reviewer -->

- [ ] Code reviewed at exact SHA
- [ ] Security assessment complete
- [ ] Quality assessment complete
- [ ] No policy-blocking issues found
- [ ] Reviewer: @<!-- username -->

### Approval Decision

- [ ] **APPROVED** - Ready for storage materialization
- [ ] **CHANGES REQUESTED** - See comments
- [ ] **REJECTED** - See comments

### If Approved

- Upstream SHA recorded: `<!-- SHA -->`
- Storage materialization will be triggered
- Build will use preserved storage, not upstream

---

## After Approval

After your PR is merged:
1. Storage will be created in axolotl-pm-pl
2. Your approved commit will be preserved there
3. Build will run from storage
4. Release will be published on axolotl-pm-pl

You will NOT have write access to the storage repository.

Updates to your plugin require new submission and review.
