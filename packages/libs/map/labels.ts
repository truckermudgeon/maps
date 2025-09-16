import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';

export function toDealerLabel(prefabPath: string): string {
  Preconditions.checkArgument(prefabPath.includes('/truck_dealer/'));
  const dealerRegex = /\/truck_dealer\/(?:truck_dealer_([^.]+).ppd$|([^/]+)\/)/;
  const matches = assertExists(dealerRegex.exec(prefabPath));
  const dealer = assertExists(matches[1] ?? matches[2]);

  switch (dealer) {
    case 'mb':
      return 'Mercedes-Benz';
    case 'westernstar':
      return 'Western Star';
    case 'daf':
    case 'man':
      return dealer.toUpperCase();
    case 'freightliner':
    case 'international':
    case 'iveco':
    case 'kenworth':
    case 'mack':
    case 'peterbilt':
    case 'renault':
    case 'scania':
    case 'volvo':
      return dealer.charAt(0).toUpperCase() + dealer.slice(1);
    default:
      throw new Error('unknown dealer: ' + dealer);
  }
}

/**
 * Returns the branch suffix for companies with multiple depot types, or
 * `undefined` if the company has no known branch suffixes (this is currently
 * the case for all ETS2 companies).
 *
 * Based on https://github.com/nautofon/Show_company_branches.
 */
export function getBranchSuffix(companyToken: string): string | undefined {
  switch (companyToken) {
    case 'asu_car_exp':
      return 'export facility';
    case 'asu_car_pln':
      return 'factory';
    case 'avs_met_scr':
      return 'scrapyard';
    case 'avs_met_sml':
      return 'smelter';
    case 'bit_rd_grg':
      return 'garage';
    case 'bit_rd_svc':
      return 'depot';
    case 'bit_rd_wrk':
      return 'roadworks';
    case 'bn_farm':
      return 'farm';
    case 'bn_live_auc':
      return 'livestock auction';
    case 'cal_car_exp':
      return 'export facility';
    case 'cal_car_pln':
      return 'factory';
    case 'ch_wd_hrv':
      return 'logging site';
    case 'ch_wd_saw':
      return 'sawmill';
    case 'cm_brx_pln':
      return 'borax plant';
    case 'cm_min_plnt':
      return 'cement plant';
    case 'cm_min_qry':
      return 'quarry';
    case 'cm_min_qryp':
      return 'potash plant';
    case 'cm_min_str':
      return 'storage';
    case 'cm_min_svc':
      return 'warehouse';
    case 'dg_wd_hrv':
      return 'logging site';
    case 'dg_wd_saw':
      return 'sawmill';
    case 'dg_wd_saw1':
      return 'sawmill';
    case 'frd_epw_sit':
      return 'substation';
    case 'frd_epw_svc':
      return 'public utility';
    case 'fb_farm_mkt':
      return 'market';
    case 'fb_farm_pln':
      return 'feed mill';
    case 'flv_food_pln':
      return 'factory';
    case 'flv_food_str':
      return 'storage';
    case 'gal_oil_gst':
      return 'underground tank';
    case 'gal_oil_ref':
      return 'refinery';
    case 'gal_oil_sit':
      return 'oil drilling site';
    case 'gal_oil_str':
      return 'oil storage';
    case 'gal_oil_str1':
      return 'storage';
    case 'gal_oil_svc':
      return 'service facility';
    case 'gal_oil_well':
      return 'oil well';
    case 'gm_chs_plnt':
      return 'dairy plant';
    case 'gm_food_plnt':
      return 'food plant';
    case 'gm_food_str':
      return 'grain elevator';
    case 'gld_frm':
      return 'farm';
    case 'gld_frm_grg':
      return 'garage';
    case 'gp_farm':
      return 'farm';
    case 'gp_live_auc':
      return 'livestock auction';
    case 'jns_rail_str':
      return 'depot';
    case 'jns_rail_wrk':
      return 'work site';
    case 'kw_trk_dlr':
      return 'dealership';
    case 'kw_trk_pln':
      return 'factory';
    case 'mon_farm':
      return 'vineyard';
    case 'mon_food_pln':
      return 'winery';
    case 'nmq_min_pln1':
      return 'talc plant';
    case 'nmq_min_plnt':
      return 'cement plant';
    case 'nmq_min_qry':
      return 'quarry';
    case 'nmq_min_qrya':
      return 'soda ash mine';
    case 'nmq_min_qrys':
      return 'salt mine';
    case 'nmq_min_str':
      return 'storage';
    case 'nmq_min_svc':
      return 'warehouse';
    case 'nls_rd_grg':
      return 'garage';
    case 'nls_rd_svc':
      return 'depot';
    case 'nls_rd_wrk':
      return 'roadworks';
    case 'pns_con_grg':
      return 'garage';
    case 'pns_con_sit':
      return 'construction';
    case 'pns_con_sit1':
      return 'basement construction';
    case 'pns_con_sit2':
      return 'house construction';
    case 'pns_con_sit3':
      return 'warehouse construction';
    case 'pns_con_whs':
      return 'warehouse';
    case 'st_met_whs':
      return 'warehouse';
    case 'st_met_wrk':
      return 'workshop';
    case 'sc_frm':
      return 'farm';
    case 'sc_frm_grg':
      return 'garage';
    case 'tay_con_grg':
      return 'garage';
    case 'tay_con_sit':
      return 'construction';
    case 'tay_con_sit1':
      return 'basement construction';
    case 'tay_con_sit2':
      return 'house construction';
    case 'tay_con_sit3':
      return 'warehouse construction';
    case 'tay_con_whs':
      return 'warehouse';
    case 'vp_epw_pln':
      return 'plant';
    case 'vp_epw_sit':
      return 'construction site';
    case 'vm_car_exp':
      return 'export facility';
    case 'vm_car_pln':
      return 'factory';
    case 'vor_oil_gst':
      return 'underground tank';
    case 'vor_oil_ref':
      return 'refinery';
    case 'vor_oil_sit':
      return 'oil drilling site';
    case 'vor_oil_str':
      return 'transshipment terminal';
    case 'vor_oil_str1':
      return 'storage';
    // TODO add suffixes for these ETS2 companies
    case 'feldbinder':
    case 'feldbinder_t':
    case 'sanbuilders':
    case 'sanbuild_hms':
    case 'sanbuild_win':
    case 'itcc_scrap':
    case 'itcc':
    case 'quarry':
    case 'steinbr_str':
    case 'villco':
    case 'villco_mkt':
    case 'krone':
    case 'krone_t':
    case 'crnodrvo_log':
    case 'crnodrvo':
    case 'cnp':
    case 'cnp_well':
    case 'eviksi':
    case 'eviksi_a':
    case 'onnelik':
    case 'onnelik_a':
    case 'agrominta_a':
    case 'agrominta':
    case 'batisse_hs':
    case 'batisse_wind':
    case 'konstnr_br':
    case 'konstnr_wind':
    default:
      return;
  }
}
