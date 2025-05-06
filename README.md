# Instagram Scraper Tool

このツールはChromeブラウザを使用してInstagramのプロフィールや投稿をスクレイピングし、ローカルディレクトリに保存します。
動画投稿の場合は、動画自体ではなくサムネイル画像のみをダウンロードします。

## 特徴

- Chromeの既存ログインセッションを利用してログイン不要
- プロフィール情報の取得
- 投稿データ（画像と情報）のダウンロード
- ハッシュタグの抽出
- JSON形式でデータを保存（Claude Desktopとの統合に最適）

## 前提条件

- Node.js (バージョン18以上)
- Chrome（リモートデバッグが有効になっている状態）

## インストール方法

```bash
# リポジトリのクローン
git clone https://github.com/thinpedelica/instagram-scraper.git
cd instagram-scraper

# 依存関係のインストール
npm install

# ビルド
npm run build
```

## Chrome設定

スクレイピングを実行する前に、Chromeをリモートデバッグモードで起動する必要があります。

### Windowsの場合

1. 既存のChromeインスタンスをすべて閉じる
2. コマンドプロンプトから以下を実行:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
   または既存のショートカットのプロパティを編集して「 --remote-debugging-port=9222」を追加

## 使い方

1. Chrome を リモートデバッグモード（ポート9222）で起動
2. Chromeで Instagram にログイン（既にログイン済みの場合は不要）
3. ツールを実行:
   ```bash
   npm run start
   ```
4. 指示に従ってスクレイピングしたいユーザー名と投稿数を入力

## データの保存場所

スクレイプされたデータは以下の場所に保存されます:
```
instagram_data/[username]/[date]/
```

各セッションディレクトリには以下のファイルが含まれます:
- `profile.json` - プロフィール情報
- `post_links.json` - 取得した投稿のURLリスト
- `all_posts.json` - すべての投稿データ

各投稿は個別のディレクトリにも保存されます:
```
instagram_data/[username]/[date]/[post_id]/
```

投稿ディレクトリには以下のファイルが含まれます:
- `post.json` - 投稿のメタデータ（キャプション、タイムスタンプなど）
- `media.jpg` - 投稿の画像または動画のサムネイル

## Claude Desktopでの利用方法

1. スクレイピングが完了した後、`instagram_data`ディレクトリに移動
2. 目的のJSONファイル（`all_posts.json`など）をClaudeにアップロード
3. 画像データを参照する場合は、その画像ファイルも一緒にアップロード

## 環境変数の設定

`.env`ファイルで以下の設定を変更できます:

```
# Chrome設定
CHROME_REMOTE_DEBUGGING_PORT=9222

# 保存先ディレクトリ
OUTPUT_DIR=./instagram_data

# スクレイピング設定
MAX_POSTS=50
BATCH_SIZE=10
SCROLL_ATTEMPTS=5
TIMEOUT=30000
```

## 参考にしたリポジトリ

このツールは以下のプロジェクトを参考に開発されました：
- [instagram-server-next-mcp](https://github.com/duhlink/instagram-server-next-mcp) - Model Context Protocol (MCP)サーバーを使用したChromeブラウザベースのInstagramスクレイパー

## 注意事項

- このツールはChromeブラウザの既存ログインセッションを利用します
- Instagramの利用規約に従って適切に使用してください
- このツールはInstagramの公式APIを使用していません