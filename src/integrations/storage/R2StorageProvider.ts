import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider, CriarUrlUploadInput, UrlUpload } from './StorageProvider.js';
import { valorCredencial } from '../credencialResolver.js';

// Cloudflare R2 — compatível com a API do S3, então usa o SDK oficial da
// AWS apontando pro endpoint do R2. Implementado a partir da documentação
// pública (developers.cloudflare.com/r2/api/s3), mas nunca testado contra
// um bucket real — este ambiente não tem acesso de rede pro R2. Valide um
// upload de teste antes de usar em produção.
//
// Env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.

function cliente(): S3Client {
  const accountId = valorCredencial('storage_r2', 'R2_ACCOUNT_ID');
  const accessKeyId = valorCredencial('storage_r2', 'R2_ACCESS_KEY_ID');
  const secretAccessKey = valorCredencial('storage_r2', 'R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Credenciais do R2 ausentes (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY).');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucket(): string {
  const nome = valorCredencial('storage_r2', 'R2_BUCKET_NAME');
  if (!nome) throw new Error('R2_BUCKET_NAME ausente.');
  return nome;
}

export class R2StorageProvider implements StorageProvider {
  async criarUrlUpload(input: CriarUrlUploadInput): Promise<UrlUpload> {
    const comando = new PutObjectCommand({
      Bucket: bucket(),
      Key: input.key,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(cliente(), comando, { expiresIn: input.expiraEmSegundos });
    return { uploadUrl, headers: { 'Content-Type': input.contentType } };
  }

  async criarUrlDownload(key: string, expiraEmSegundos: number): Promise<string> {
    const comando = new GetObjectCommand({ Bucket: bucket(), Key: key });
    return getSignedUrl(cliente(), comando, { expiresIn: expiraEmSegundos });
  }

  async excluir(key: string): Promise<void> {
    await cliente().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  }
}
