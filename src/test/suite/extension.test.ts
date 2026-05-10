import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('apimate.apimate'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('apimate.apimate');
    await extension?.activate();
    assert.ok(extension?.isActive);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('apimate.newRequest'));
    assert.ok(commands.includes('apimate.newCollection'));
    assert.ok(commands.includes('apimate.importCollection'));
    assert.ok(commands.includes('apimate.exportCollection'));
    assert.ok(commands.includes('apimate.switchEnvironment'));
    assert.ok(commands.includes('apimate.runCollection'));
  });
});
