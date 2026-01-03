import { supabase } from '../lib/supabase';

export const hospitalDocumentService = {
    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('hospital_documents')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false });

        if (error) throw error;
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

        if (uploadError) throw uploadError;

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
            throw dbError;
        }

        return data;
    },

    async delete(documentId: string, filePath: string) {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('hospital-documents')
            .remove([filePath]);

        if (storageError) throw storageError;

        // 2. Delete from Database
        const { error: dbError } = await supabase
            .from('hospital_documents')
            .delete()
            .eq('id', documentId);

        if (dbError) throw dbError;
    },

    getPublicUrl(filePath: string) {
        const { data: { publicUrl } } = supabase.storage
            .from('hospital-documents')
            .getPublicUrl(filePath);
        return publicUrl;
    }
};
