/**
 * Design System Playground
 *
 * A development-only page for visual verification of all UI components.
 * This page is NOT included in production builds.
 *
 * Access: /playground (development only)
 */

import {
  // Layout
  Container,
  Section,
  SectionHeader,
  Divider,
  Stack,
  Inline,
  Grid,

  // Primitives
  Text,
  Heading,
  Code,
  CodeBlock,

  // Actions
  Button,
  IconButton,

  // Data Display
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  StatusBadge,
  Avatar,
  Skeleton,

  // Feedback
  LoadingState,
  EmptyState,
  ErrorState,

  // Navigation
  Link,
  Pagination,

  // Forms
  Input,
} from '@/components/ui';

export function PlaygroundPage() {
  return (
    <Container size="xl" className="py-8">
      <Stack spacing="xl">
        {/* Typography */}
        <Section>
          <SectionHeader title="Typography" description="Text primitives for consistent typography" />

          <Card padding="lg">
            <Stack spacing="md">
              <Heading level="h1">Heading 1 — Page Title</Heading>
              <Heading level="h2">Heading 2 — Section Title</Heading>
              <Heading level="h3">Heading 3 — Card Title</Heading>
              <Heading level="h4">Heading 4 — Subsection</Heading>

              <Divider />

              <Text variant="primary">Primary text — Main content</Text>
              <Text variant="secondary">Secondary text — Supporting content</Text>
              <Text variant="muted">Muted text — Subtle information</Text>
              <Text variant="success">Success text — Positive feedback</Text>
              <Text variant="warning">Warning text — Caution notice</Text>
              <Text variant="error">Error text — Error message</Text>

              <Divider />

              <Text weight="normal">Normal weight</Text>
              <Text weight="medium">Medium weight</Text>
              <Text weight="semibold">Semibold weight</Text>
              <Text weight="bold">Bold weight</Text>

              <Divider />

              <Text size="xs">Extra small text</Text>
              <Text size="sm">Small text</Text>
              <Text size="base">Base text</Text>
              <Text size="lg">Large text</Text>
              <Text size="xl">Extra large text</Text>

              <Divider />

              <Text>
                Inline code: <Code>npm install</Code> and then <Code>yarn start</Code>
              </Text>

              <CodeBlock>{`function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`}</CodeBlock>
            </Stack>
          </Card>
        </Section>

        {/* Buttons */}
        <Section>
          <SectionHeader title="Buttons" description="Interactive button components" />

          <Card padding="lg">
            <Stack spacing="lg">
              <div>
                <Text weight="medium" className="mb-2">Variants</Text>
                <Inline spacing="sm">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Sizes</Text>
                <Inline spacing="sm" align="center">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">States</Text>
                <Inline spacing="sm">
                  <Button>Default</Button>
                  <Button isLoading>Loading</Button>
                  <Button disabled>Disabled</Button>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">With Icons</Text>
                <Inline spacing="sm">
                  <Button leftIcon={<span>←</span>}>With Left Icon</Button>
                  <Button rightIcon={<span>→</span>}>With Right Icon</Button>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Icon Buttons</Text>
                <Inline spacing="sm">
                  <IconButton icon={<span>✕</span>} aria-label="Close" size="sm" />
                  <IconButton icon={<span>✕</span>} aria-label="Close" size="md" />
                  <IconButton icon={<span>✕</span>} aria-label="Close" size="lg" />
                  <IconButton icon={<span>✕</span>} aria-label="Close" variant="primary" />
                  <IconButton icon={<span>✕</span>} aria-label="Close" variant="destructive" />
                </Inline>
              </div>
            </Stack>
          </Card>
        </Section>

        {/* Badges */}
        <Section>
          <SectionHeader title="Badges" description="Small labels for status and categories" />

          <Card padding="lg">
            <Stack spacing="lg">
              <div>
                <Text weight="medium" className="mb-2">Variants</Text>
                <Inline spacing="sm">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="error">Error</Badge>
                  <Badge variant="info">Info</Badge>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Sizes</Text>
                <Inline spacing="sm" align="center">
                  <Badge size="sm">Small</Badge>
                  <Badge size="md">Medium</Badge>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Status Badges</Text>
                <Inline spacing="sm">
                  <StatusBadge status="approved" />
                  <StatusBadge status="materialized" />
                  <StatusBadge status="published" />
                  <StatusBadge status="deprecated" />
                  <StatusBadge status="revoked" />
                  <StatusBadge status="removed" />
                </Inline>
              </div>
            </Stack>
          </Card>
        </Section>

        {/* Cards */}
        <Section>
          <SectionHeader title="Cards" description="Container components for grouped content" />

          <Grid columns={{ sm: 1, md: 2 }} gap="lg">
            <Card hover>
              <CardHeader>
                <CardTitle>Card with Hover</CardTitle>
                <CardDescription>This card has hover effect enabled</CardDescription>
              </CardHeader>
              <CardContent>
                <Text>Card content goes here. Cards can contain any content.</Text>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regular Card</CardTitle>
                <CardDescription>Without hover effect</CardDescription>
              </CardHeader>
              <CardContent>
                <Text>Simple card without hover interaction.</Text>
              </CardContent>
            </Card>
          </Grid>
        </Section>

        {/* Avatar */}
        <Section>
          <SectionHeader title="Avatars" description="User avatar components with fallback" />

          <Card padding="lg">
            <Inline spacing="lg" align="center">
              <Avatar name="John Doe" size="sm" />
              <Avatar name="Jane Smith" size="md" />
              <Avatar name="Bob Wilson" size="lg" />
              <Avatar name="Alice Brown" size="xl" />
              <Avatar src={null} name="No Image" />
            </Inline>
          </Card>
        </Section>

        {/* Feedback */}
        <Section>
          <SectionHeader title="Feedback" description="Components for loading, empty, and error states" />

          <Grid columns={{ sm: 1, md: 3 }} gap="lg">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Loading</CardTitle>
              </CardHeader>
              <CardContent>
                <LoadingState message="Loading data..." />
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Empty State</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="No items found"
                  description="Try adjusting your search criteria"
                />
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Error State</CardTitle>
              </CardHeader>
              <CardContent>
                <ErrorState
                  message="Failed to load data"
                  onRetry={() => {}}
                />
              </CardContent>
            </Card>
          </Grid>
        </Section>

        {/* Skeletons */}
        <Section>
          <SectionHeader title="Skeletons" description="Loading placeholder components" />

          <Card padding="lg">
            <Stack spacing="md">
              <Inline spacing="md" align="center">
                <Skeleton variant="circular" width={40} height={40} />
                <Stack spacing="sm">
                  <Skeleton variant="text" width={200} />
                  <Skeleton variant="text" width={150} />
                </Stack>
              </Inline>

              <Divider />

              <Grid columns={3} gap="md">
                <Card padding="md">
                  <Inline spacing="sm" align="center">
                    <Skeleton variant="circular" width={32} height={32} />
                    <Stack spacing="xs">
                      <Skeleton variant="text" width={100} />
                      <Skeleton variant="text" width={80} />
                    </Stack>
                  </Inline>
                </Card>
                <Card padding="md">
                  <Inline spacing="sm" align="center">
                    <Skeleton variant="circular" width={32} height={32} />
                    <Stack spacing="xs">
                      <Skeleton variant="text" width={100} />
                      <Skeleton variant="text" width={80} />
                    </Stack>
                  </Inline>
                </Card>
                <Card padding="md">
                  <Inline spacing="sm" align="center">
                    <Skeleton variant="circular" width={32} height={32} />
                    <Stack spacing="xs">
                      <Skeleton variant="text" width={100} />
                      <Skeleton variant="text" width={80} />
                    </Stack>
                  </Inline>
                </Card>
              </Grid>
            </Stack>
          </Card>
        </Section>

        {/* Form Inputs */}
        <Section>
          <SectionHeader title="Form Inputs" description="Form input components" />

          <Card padding="lg">
            <Stack spacing="md">
              <Input label="Default Input" placeholder="Enter text..." />
              <Input label="With Hint" hint="This is a helpful hint" placeholder="Enter text..." />
              <Input label="With Error" error="This field is required" placeholder="Enter text..." />
              <Input label="Disabled" disabled placeholder="Cannot edit" />
            </Stack>
          </Card>
        </Section>

        {/* Pagination */}
        <Section>
          <SectionHeader title="Pagination" description="Navigation between pages" />

          <Card padding="lg">
            <Stack spacing="md" align="center">
              <Pagination currentPage={1} totalPages={10} onPageChange={() => {}} />
              <Pagination currentPage={5} totalPages={10} onPageChange={() => {}} />
            </Stack>
          </Card>
        </Section>

        {/* Layout Primitives */}
        <Section>
          <SectionHeader title="Layout Primitives" description="Stack, Inline, and Grid layouts" />

          <Card padding="lg">
            <Stack spacing="lg">
              <div>
                <Text weight="medium" className="mb-2">Stack (Vertical)</Text>
                <Stack spacing="sm" className="bg-gray-50 p-4 rounded">
                  <div className="bg-gray-200 p-2 rounded">Item 1</div>
                  <div className="bg-gray-200 p-2 rounded">Item 2</div>
                  <div className="bg-gray-200 p-2 rounded">Item 3</div>
                </Stack>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Inline (Horizontal)</Text>
                <Inline spacing="sm" className="bg-gray-50 p-4 rounded">
                  <div className="bg-gray-200 p-2 rounded">Item 1</div>
                  <div className="bg-gray-200 p-2 rounded">Item 2</div>
                  <div className="bg-gray-200 p-2 rounded">Item 3</div>
                </Inline>
              </div>

              <div>
                <Text weight="medium" className="mb-2">Grid</Text>
                <Grid columns={3} gap="sm" className="bg-gray-50 p-4 rounded">
                  <div className="bg-gray-200 p-2 rounded text-center">1</div>
                  <div className="bg-gray-200 p-2 rounded text-center">2</div>
                  <div className="bg-gray-200 p-2 rounded text-center">3</div>
                  <div className="bg-gray-200 p-2 rounded text-center">4</div>
                  <div className="bg-gray-200 p-2 rounded text-center">5</div>
                  <div className="bg-gray-200 p-2 rounded text-center">6</div>
                </Grid>
              </div>
            </Stack>
          </Card>
        </Section>

        {/* Links */}
        <Section>
          <SectionHeader title="Links" description="Navigation link components" />

          <Card padding="lg">
            <Stack spacing="md">
              <Text>
                Visit the <Link to="/">Home Page</Link> for more information.
              </Text>
              <Text>
                Check <Link href="https://github.com">GitHub</Link> for source code.
              </Text>
            </Stack>
          </Card>
        </Section>

        {/* Spacing Scale */}
        <Section>
          <SectionHeader title="Spacing Scale" description="Consistent spacing values" />

          <Card padding="lg">
            <Stack spacing="md">
              <Inline spacing="md" align="center">
                <div className="w-1 h-4 bg-primary-500" />
                <Text size="sm">space-1</Text>
              </Inline>
              <Inline spacing="md" align="center">
                <div className="w-2 h-4 bg-primary-500" />
                <Text size="sm">space-2</Text>
              </Inline>
              <Inline spacing="md" align="center">
                <div className="w-4 h-4 bg-primary-500" />
                <Text size="sm">space-4</Text>
              </Inline>
              <Inline spacing="md" align="center">
                <div className="w-6 h-4 bg-primary-500" />
                <Text size="sm">space-6</Text>
              </Inline>
              <Inline spacing="md" align="center">
                <div className="w-8 h-4 bg-primary-500" />
                <Text size="sm">space-8</Text>
              </Inline>
            </Stack>
          </Card>
        </Section>
      </Stack>
    </Container>
  );
}
