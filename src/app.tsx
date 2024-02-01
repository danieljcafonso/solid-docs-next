// @refresh reload
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start";
import { MDXProvider } from "solid-mdx";
import { ErrorBoundary, Suspense } from "solid-js";
import { MetaProvider, Title } from "@solidjs/meta";

import Md from "~/ui/markdown-components";
import { Layout } from "~/ui/layout";
import "~/styles.css";

export default function App() {
	return (
		<Router
			root={(props) => (
				<MetaProvider>
					<Title>Solid Docs</Title>
					<ErrorBoundary
						fallback={(e) => <pre>{JSON.stringify(e, null, 2)}</pre>}
					>
						<Layout>
							<MDXProvider components={Md}>
								<Suspense>{props.children}</Suspense>
							</MDXProvider>
						</Layout>
					</ErrorBoundary>
				</MetaProvider>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
