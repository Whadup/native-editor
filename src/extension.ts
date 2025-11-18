import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'myTextareaEditor',
            new TextareaEditorProvider(context),
            {
                supportsMultipleEditorsPerDocument: false
            }
        )
    );
}

class TextareaEditorProvider implements vscode.CustomTextEditorProvider {

    constructor(private readonly context: vscode.ExtensionContext) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {

        // Enable scripts in the webview
        webviewPanel.webview.options = {
            enableScripts: true
        };

        // Set initial HTML
        webviewPanel.webview.html = this.getHtmlForWebview(document.getText(), webviewPanel.webview);

        // Handle changes from webview
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'update') {
                this.updateTextDocument(document, e.text);
            }
        });

        // Update webview if document changes externally
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({
                    type: 'update',
                    text: document.getText()
                });
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private getHtmlForWebview(content: string, webview: vscode.Webview): string {
        const escaped = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `
            <!DOCTYPE html>
            <html lang="en">
			<style>
				body, html {
					padding: 0;
					margin: 0;
					height: 100%;
					width: 100%;
				}
				#editor {
					width: 100%;
					height: 100%;
					box-sizing: border-box;
					font-family: monospace;
					resize: none;
				}
			</style>
            <body>
                <textarea id="editor" style="width:100%;height:100%;">${escaped}</textarea>
                <script>
                    const vscode = acquireVsCodeApi();
                    const textarea = document.getElementById('editor');

                    textarea.addEventListener('input', () => {
                        vscode.postMessage({
                            type: 'update',
                            text: textarea.value
                        });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            textarea.value = message.text;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private updateTextDocument(document: vscode.TextDocument, value: string) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, value);
        return vscode.workspace.applyEdit(edit);
    }
}
export function deactivate() {}