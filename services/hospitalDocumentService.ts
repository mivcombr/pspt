import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const hospitalDocumentService = {
    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('hospital_documents')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error({ action: 'read', entity: 'hospital_documents', hospital_id: hospitalId, error }, 'crud');
            throw error;
        }
        return data;
    },

    async upload(hospitalId: string, file: File) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${hospitalId}/${fileName}`;

        // 1. Upload file to Storage
        const { error: uploadError } = await supabase.storage
            .from('hospital-documents')
            .upload(filePath, file);

        if (uploadError) {
            logger.error({ action: 'create', entity: 'hospital_documents', hospital_id: hospitalId, error: uploadError }, 'crud');
            throw uploadError;
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('hospital-documents')
            .getPublicUrl(filePath);

        // 3. Save metadata to Database
        const { data, error: dbError } = await supabase
            .from('hospital_documents')
            .insert({
                hospital_id: hospitalId,
                name: file.name,
                file_path: filePath,
                file_type: file.type,
                file_size: file.size,
                user_id: user.id
            })
            .select()
            .single();

        if (dbError) {
            // Cleanup: delete file if DB insert fails
            await supabase.storage.from('hospital-documents').remove([filePath]);
            logger.error({ action: 'create', entity: 'hospital_documents', hospital_id: hospitalId, error: dbError }, 'crud');
            throw dbError;
        }

        logger.info({ action: 'create', entity: 'hospital_documents', id: data?.id }, 'crud');
        return data;
    },

    async delete(documentId: string, filePath: string) {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('hospital-documents')
            .remove([filePath]);

        if (storageError) {
            logger.error({ action: 'delete', entity: 'hospital_documents', id: documentId, error: storageError }, 'crud');
            throw storageError;
        }

        // 2. Delete from Database
        const { error: dbError } = await supabase
            .from('hospital_documents')
            .delete()
            .eq('id', documentId);

        if (dbError) {
            logger.error({ action: 'delete', entity: 'hospital_documents', id: documentId, error: dbError }, 'crud');
            throw dbError;
        }
        logger.info({ action: 'delete', entity: 'hospital_documents', id: documentId }, 'crud');
    },

    getPublicUrl(filePath: string) {
        const { data: { publicUrl } } = supabase.storage
            .from('hospital-documents')
            .getPublicUrl(filePath);
        return publicUrl;
    }
};
