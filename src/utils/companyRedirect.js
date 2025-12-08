// Utility function to check if user belongs to a company and redirect accordingly
import { supabase } from '../lib/supabase.js';

export const checkCompanyMembershipAndRedirect = async (navigate) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false; // Not logged in
    }

    const { data: membership, error } = await supabase
      .from('user_companies')
      .select('company_id, companies(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[companyRedirect] Error checking membership:', error);
      return false;
    }

    if (membership) {
      // User belongs to a company, redirect to company recording page
      console.log('[companyRedirect] User is company user, redirecting to /company-record');
      navigate('/company-record');
      return true;
    }

    return false; // Not a company user
  } catch (err) {
    console.error('[companyRedirect] Exception:', err);
    return false;
  }
};

