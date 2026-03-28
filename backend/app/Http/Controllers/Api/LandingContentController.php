<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingContent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LandingContentController extends Controller
{
    /** Konten aktif untuk landing: ringan (tanpa body penuh), + preview teks. */
    public function publicIndex(Request $request)
    {
        $limit = min(max((int) $request->query('limit', 100), 1), 100);

        $rows = LandingContent::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->limit($limit)
            ->get([
                'id', 'title', 'slug', 'excerpt', 'body', 'kind', 'image_url', 'link_url', 'cta_label', 'sort_order',
            ]);

        return $rows->map(fn (LandingContent $c) => $this->toPublicListPayload($c));
    }

    /** Satu konten aktif by slug (Markdown body lengkap). */
    public function publicShow(string $slug)
    {
        $content = LandingContent::query()
            ->where('is_active', true)
            ->where('slug', $slug)
            ->firstOrFail();

        return $content->only([
            'id', 'title', 'slug', 'excerpt', 'body', 'kind', 'image_url', 'link_url', 'cta_label', 'created_at', 'updated_at',
        ]);
    }

    /**
     * Unggah gambar untuk CKEditor (field `upload`); mengembalikan JSON { "url": "..." }.
     */
    public function uploadImage(Request $request)
    {
        $user = $request->user();
        if (! $user?->hasPermission('landing_content.create') && ! $user?->hasPermission('landing_content.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $request->validate([
            'upload' => 'required|image|mimes:jpeg,png,jpg,webp,gif|max:5120',
        ]);

        $path = str_replace('\\', '/', $request->file('upload')->store('landing-content', 'public'));
        // URL relatif agar gambar tampil di Vite (proxy /storage) dan di produksi tanpa bergantung pada APP_URL.
        $url = '/storage/'.$path;

        return response()->json(['url' => $url]);
    }

    /** Daftar untuk admin: paginasi, pencarian, filter. */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);

        $query = LandingContent::query()->orderBy('sort_order')->orderBy('id');

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('body', 'like', '%'.$search.'%')
                    ->orWhere('excerpt', 'like', '%'.$search.'%')
                    ->orWhere('slug', 'like', '%'.$search.'%');
            });
        }

        $status = $request->query('status', 'all');
        if (in_array($status, ['active', 'inactive'], true)) {
            $query->where('is_active', $status === 'active');
        }

        if ($request->filled('kind')) {
            $request->validate(['kind' => 'in:promo,pengumuman,info']);
            $query->where('kind', $request->query('kind'));
        }

        return $query->paginate($perPage);
    }

    public function store(Request $request)
    {
        if (! $request->user()?->hasPermission('landing_content.create')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $valid = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:192',
            'excerpt' => 'nullable|string|max:2000',
            'body' => 'nullable|string|max:200000',
            'kind' => 'required|in:promo,pengumuman,info',
            'image_url' => 'nullable|string|max:2048',
            'link_url' => 'nullable|string|max:2048',
            'cta_label' => 'nullable|string|max:120',
            'sort_order' => 'nullable|integer|min:0|max:999999',
            'is_active' => 'boolean',
        ]);

        $valid['slug'] = $this->resolveSlugForCreate(
            isset($valid['slug']) ? trim((string) $valid['slug']) : null,
            $valid['title']
        );

        return LandingContent::create($valid);
    }

    public function show(LandingContent $landingContent)
    {
        return $landingContent;
    }

    public function update(Request $request, LandingContent $landingContent)
    {
        if (! $request->user()?->hasPermission('landing_content.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $valid = $request->validate([
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|nullable|string|max:192',
            'excerpt' => 'nullable|string|max:2000',
            'body' => 'nullable|string|max:200000',
            'kind' => 'sometimes|in:promo,pengumuman,info',
            'image_url' => 'nullable|string|max:2048',
            'link_url' => 'nullable|string|max:2048',
            'cta_label' => 'nullable|string|max:120',
            'sort_order' => 'nullable|integer|min:0|max:999999',
            'is_active' => 'boolean',
        ]);

        if ($request->has('slug')) {
            $raw = $request->input('slug');
            if ($raw === null || trim((string) $raw) === '') {
                $valid['slug'] = $this->resolveSlugForCreate(null, $valid['title'] ?? $landingContent->title);
            } else {
                $valid['slug'] = $this->ensureUniqueSlug(Str::slug(trim((string) $raw)), $landingContent->id);
            }
        }

        $landingContent->update($valid);

        return $landingContent->fresh();
    }

    public function destroy(Request $request, LandingContent $landingContent)
    {
        if (! $request->user()?->hasPermission('landing_content.delete')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $landingContent->delete();

        return response()->json(null, 204);
    }

    private function toPublicListPayload(LandingContent $c): array
    {
        $preview = $c->excerpt;
        if ($preview === null && $c->body) {
            $plain = preg_replace('/\s+/u', ' ', strip_tags($c->body));
            $preview = Str::limit(trim($plain), 220);
        }

        return [
            'id' => $c->id,
            'title' => $c->title,
            'slug' => $c->slug,
            'kind' => $c->kind,
            'image_url' => $c->image_url,
            'link_url' => $c->link_url,
            'cta_label' => $c->cta_label,
            'sort_order' => $c->sort_order,
            'preview' => $preview,
        ];
    }

    private function resolveSlugForCreate(?string $slugInput, string $title): string
    {
        if ($slugInput !== null && $slugInput !== '') {
            return $this->ensureUniqueSlug(Str::slug($slugInput), null);
        }

        $base = Str::slug($title);
        if ($base === '') {
            $base = 'konten-'.substr(str_replace('.', '', uniqid('', true)), -10);
        }

        return $this->ensureUniqueSlug($base, null);
    }

    private function ensureUniqueSlug(string $base, ?int $exceptId): string
    {
        if ($base === '') {
            $base = 'konten';
        }
        $candidate = $base;
        $n = 2;
        while (LandingContent::query()
            ->where('slug', $candidate)
            ->when($exceptId !== null, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists()) {
            $candidate = $base.'-'.$n;
            $n++;
        }

        return $candidate;
    }
}
