import React, { useState } from 'react';
import { Network, Settings2, Radio, AlertCircle, Lock, RefreshCw, Phone, Server, Wifi, Copy, Check } from 'lucide-react';

type ConfigSection = 'WANLINK' | 'SBC';
type ConfigType = 'FTTH' | 'FTTO';
type FTTHProvider = 'Orange' | 'Axione' | 'IFT';
type AxioneType = 'pro' | 'opera';

interface ConfigFields {
  [key: string]: string;
}

function App() {
  const [section, setSection] = useState<ConfigSection | null>(null);
  const [configType, setConfigType] = useState<ConfigType | null>(null);
  const [provider, setProvider] = useState<FTTHProvider | null>(null);
  const [axioneType, setAxioneType] = useState<AxioneType | null>(null);
  const [configFields, setConfigFields] = useState<ConfigFields>({});
  const [generatedConfig, setGeneratedConfig] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(generatedConfig);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setConfigFields(prev => ({
      ...prev,
      [field]: value
    }));
    validateConfig();
  };

  const validateConfig = () => {
    if (section === 'SBC') {
      const hasNumbers = configFields.numbers?.trim().length > 0;
      const hasValidRegex = configFields.regex?.startsWith('<next type="regex">') && 
                           configFields.regex?.endsWith('</next>');
      const hasLRTType = configFields.isCentileLRT === 'true' || configFields.isCentileLRT === 'false';
      setIsValid(hasNumbers && hasValidRegex && hasLRTType);
      return;
    }

    const requiredFields = getRequiredFields();
    const allFieldsFilled = requiredFields.every(field => {
      const value = configFields[field]?.trim() || '';
      if (field === 'ipAddress') {
        return isValidIPv4(value);
      }
      if (field === 'wlId') {
        return /^WL-\d{6}$/.test(value);
      }
      if (field === 'svlan') {
        return /^\d{1,4}$/.test(value);
      }
      return value !== '';
    });
    setIsValid(allFieldsFilled);
  };

  const isValidIPv4 = (ip: string) => {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  };

  const getRequiredFields = () => {
    if (configType === 'FTTO') {
      return ['wlId', 'siteName', 'ipAddress', 'vlanId'];
    }
    
    switch (provider) {
      case 'Orange':
        return ['ipAddress', 'pppoeUsername', 'password', 'siteName'];
      case 'Axione':
        return ['ipAddress', 'wlId', 'password', 'siteName'];
      case 'IFT':
        const fields = ['wlId', 'siteName', 'ipAddress', 'svlan', 'isVrf'];
        if (configFields.isVrf === 'true') {
          fields.push('trigramme');
        }
        return fields;
      default:
        return [];
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: { [key: string]: string } = {
      ipAddress: 'Adresse IP Publique',
      pppoeUsername: 'Identifiant PPPoE (WL-XXXXX@ipvpn.tims.oc)',
      wlId: 'Identifiant WL (format WL-XXXXXX)',
      password: 'Mot de passe PPPoE',
      siteName: 'Nom du site client',
      clientName: 'Nom du client',
      sector: 'Secteur',
      connectionId: 'ID de connexion',
      vlanId: 'Numéro de VLAN (format XXXX)',
      svlan: 'Numéro de SVLAN (format XXXX)',
      isVrf: 'VRF Client',
      trigramme: 'Trigramme Client'
    };
    return labels[field] || field;
  };

  const handleGenerateConfig = () => {
    if (section === 'SBC') {
      const prefix = configFields.isCentileLRT === 'true' ? '33' : '0';
      const numbers = configFields.numbers
        .split('\n')
        .filter(n => n.trim())
        .map(n => n.trim());
      
      const lrtConfig = numbers.map(number => 
        `<route>\n<user type="string">${prefix}${number.replace(/^0+/, '')}</user>\n${configFields.regex}\n</route>`
      ).join('\n');
      
      setGeneratedConfig(lrtConfig);
      return;
    }

    if (configType === 'FTTO') {
      const config = `# Configuration MIKROTIK (TIMPRRT25MKTWAN1):

/interface vlan add interface=Bond-SW-PROD name=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN vlan-id=${configFields.vlanId} comment="${configFields.siteName}"
/interface vrrp add authentication=simple name=VRRP_VL${configFields.vlanId}_${configFields.wlId} interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN version=2 comment="${configFields.siteName}" password=PRvl${configFields.vlanId}
/ip address add address=100.127.126.2/29 interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN
/ip address add address=100.127.126.1 interface=VRRP_VL${configFields.vlanId}_${configFields.wlId} comment="${configFields.siteName}" network=${configFields.ipAddress}
/ip dhcp-server add address-pool=${configFields.ipAddress} disabled=no interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN name=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN conflict-detection=no comment="${configFields.siteName}"
/ip dhcp-server network add address=${configFields.ipAddress}/32 dns-server=1.1.1.1,8.8.8.8 gateway=100.127.126.1

# Configuration MIKROTIK (TIMPRRT26MKTWAN2):

/interface vlan add interface=Bond-SW-PROD name=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN vlan-id=${configFields.vlanId} comment="${configFields.siteName}"
/interface vrrp add authentication=simple name=VRRP_VL${configFields.vlanId}_${configFields.wlId} interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN version=2 priority=50 comment="${configFields.siteName}" password=PRvl${configFields.vlanId}
/ip address add address=100.127.126.3/29 interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN
/ip address add address=100.127.126.1 interface=VRRP_VL${configFields.vlanId}_${configFields.wlId} comment="${configFields.siteName}" network=${configFields.ipAddress}
/ip dhcp-server add address-pool=${configFields.ipAddress} disabled=no interface=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN name=VL${configFields.vlanId}_${configFields.wlId}-ICO-IPVPN comment="${configFields.siteName}" conflict-detection=no
/ip dhcp-server network add address=${configFields.ipAddress}/32 dns-server=1.1.1.1,8.8.8.8 gateway=100.127.126.1

# Configuration CISCO NEXUS PROD:

configure terminal
vlan ${configFields.vlanId}
name ${configFields.wlId}-ICO-IPVPN
exit
exit
wr`;
      setGeneratedConfig(config);
    } else if (configType === 'FTTH' && provider === 'Orange') {
      const config = `/user-manager/user add attributes=Framed-IP-Address:${configFields.ipAddress} comment="${configFields.siteName}" group=tims.oc name=${configFields.pppoeUsername} password=${configFields.password}`;
      setGeneratedConfig(config);
    } else if (configType === 'FTTH' && provider === 'Axione') {
      const group = axioneType === 'pro' ? 'tims.axi.pro' : 'tims.axi.ope';
      const tunnelConfig = `/user-manager/user add group=${group} name=${configFields.wlId}@tims-ftth-ax`;
      const cpeAuthConfig = `/user-manager/user add attributes=Mikrotik-Group:tims.ax,Framed-IP-Address:${configFields.ipAddress} comment="${configFields.siteName}" name=${configFields.wlId}`;
      const ipvpnConfig = `/user-manager/user add attributes=Framed-IP-Address:${configFields.ipAddress} comment="${configFields.siteName}" group=tims.ax name=${configFields.wlId}@ipvpn.tims.axi password=${configFields.password}`;
      
      setGeneratedConfig(`# Configuration Tunnel\n${tunnelConfig}\n\n# Configuration CPE\n${cpeAuthConfig}\n\n# Configuration IPVPN\n${ipvpnConfig}`);
    } else if (configType === 'FTTH' && provider === 'IFT') {
      let config = '';
      
      if (configFields.isVrf === 'true') {
        config = `# Configuration MIKROTIK VIRTUEL (TIMPRRT25MKTWAN1):

\x1b[91m\x1b[1;31mAttention la VRF doit déjà être crée avant de pousser cette config! cf script Add_VRF_BNG\x1b[0m

/interface vlan add interface=sfp-sfpplus2-ift name=SVL${configFields.svlan}_IFT-${configFields.wlId} vlan-id=${configFields.svlan} comment="${configFields.siteName}"
/interface vlan add interface=SVL${configFields.svlan}_IFT-${configFields.wlId} name=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} vlan-id=300 comment="${configFields.siteName}"
/ip address add address=100.127.126.1 interface=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} network=${configFields.ipAddress}
/ip dhcp-server add address-pool=${configFields.ipAddress} disabled=no interface=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} name=DHCP_SVL${configFields.svlan}_IFT_${configFields.wlId} conflict-detection=no comment="${configFields.siteName}"
/ip dhcp-server network add address=${configFields.ipAddress}/32 dns-server=1.1.1.1,8.8.8.8 gateway=100.127.126.1
/interface list member add interface=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} list=IFL-${configFields.trigramme}`;
      } else {
        config = `# Configuration MIKROTIK VIRTUEL (TIMPRRT25MKTWAN1):

/interface vlan add interface=sfp-sfpplus2-ift name=SVL${configFields.svlan}_IFT-${configFields.wlId} vlan-id=${configFields.svlan} comment="${configFields.siteName}"
/interface vlan add interface=SVL${configFields.svlan}_IFT-${configFields.wlId} name=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} vlan-id=300 comment="${configFields.siteName}"
/ip address add address=100.127.126.1 interface=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} network=${configFields.ipAddress}
/ip dhcp-server add address-pool=${configFields.ipAddress} disabled=no interface=SVL${configFields.svlan}_CVL300_IFT_${configFields.wlId} name=DHCP_SVL${configFields.svlan}_IFT_${configFields.wlId} conflict-detection=no comment="${configFields.siteName}"
/ip dhcp-server network add address=${configFields.ipAddress}/32 dns-server=1.1.1.1,8.8.8.8 gateway=100.127.126.1`;
      }
      
      setGeneratedConfig(config);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Server className="h-12 w-12 text-blue-600" strokeWidth={1.5} />
            <Wifi className="h-10 w-10 text-blue-400 animate-pulse" strokeWidth={1.5} />
            <Network className="h-12 w-12 text-blue-600" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Network Config Generator</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Générez rapidement et facilement vos configurations réseau pour FTTH, FTTO et SBC.
          </p>
        </div>

        {/* Navigation Menu */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow-md p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setSection('WANLINK');
                  setConfigType(null);
                  setProvider(null);
                  setConfigFields({});
                  setGeneratedConfig('');
                }}
                className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all duration-200 ${
                  section === 'WANLINK'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Network className="h-5 w-5" />
                <span>Configuration WANLink</span>
              </button>
              <button
                onClick={() => {
                  setSection('SBC');
                  setConfigType(null);
                  setProvider(null);
                  setConfigFields({});
                  setGeneratedConfig('');
                }}
                className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all duration-200 ${
                  section === 'SBC'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Phone className="h-5 w-5" />
                <span>Configuration SBC</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {section === 'WANLINK' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Settings2 className="h-5 w-5 mr-2 text-blue-500" />
                Type de Configuration
              </h2>

              <div className="space-y-4">
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setConfigType('FTTH');
                      setProvider(null);
                      setConfigFields({});
                      setAxioneType(null);
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg border ${
                      configType === 'FTTH'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    FTTH
                  </button>
                  <button
                    onClick={() => {
                      setConfigType('FTTO');
                      setProvider(null);
                      setConfigFields({});
                      setAxioneType(null);
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg border ${
                      configType === 'FTTO'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    FTTO
                  </button>
                </div>

                {configType === 'FTTH' && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-3">Fournisseur</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {(['Orange', 'Axione', 'IFT'] as FTTHProvider[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setProvider(p);
                            setConfigFields({});
                            setAxioneType(null);
                          }}
                          className={`py-2 px-4 rounded-lg border ${
                            provider === p
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {provider === 'Axione' && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-3">Type Axione</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setAxioneType('pro');
                          setConfigFields({});
                        }}
                        className={`py-2 px-4 rounded-lg border ${
                          axioneType === 'pro'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        FTTH Pro
                      </button>
                      <button
                        onClick={() => {
                          setAxioneType('opera');
                          setConfigFields({});
                        }}
                        className={`py-2 px-4 rounded-lg border ${
                          axioneType === 'opera'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        FTTH Opera
                      </button>
                    </div>
                  </div>
                )}

                {((configType === 'FTTH' && provider && (provider !== 'Axione' || axioneType)) || configType === 'FTTO') && (
                  <div className="mt-6 space-y-4">
                    {getRequiredFields().map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {getFieldLabel(field)}
                        </label>
                        {field === 'password' ? (
                          <div className="flex space-x-2">
                            <div className="flex-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={configFields[field] || ''}
                                  onChange={(e) => handleFieldChange(field, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <Lock className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                                const password = Array.from(crypto.getRandomValues(new Uint8Array(20)))
                                  .map((x) => chars[x % chars.length])
                                  .join('');
                                handleFieldChange('password', password);
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                              title="Générer un mot de passe aléatoire"
                            >
                              <RefreshCw className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        ) : field === 'isVrf' ? (
                          <div className="flex space-x-4">
                            <button
                              onClick={() => handleFieldChange('isVrf', 'true')}
                              className={`flex-1 py-2 px-4 rounded-lg border ${
                                configFields.isVrf === 'true'
                                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Oui
                            </button>
                            <button
                              onClick={() => handleFieldChange('isVrf', 'false')}
                              className={`flex-1 py-2 px-4 rounded-lg border ${
                                configFields.isVrf === 'false'
                                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={configFields[field] || ''}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                              field === 'ipAddress' && configFields[field] && !isValidIPv4(configFields[field])
                                ? 'border-red-500'
                                : ''
                            }`}
                          />
                        )}
                        {field === 'ipAddress' && configFields[field] && !isValidIPv4(configFields[field]) && (
                          <p className="mt-1 text-sm text-red-500">Veuillez entrer une adresse IPv4 valide</p>
                        )}
                        {field === 'wlId' && configFields[field] && !/^WL-\d{6}$/.test(configFields[field]) && (
                          <p className="mt-1 text-sm text-red-500">Format invalide. Utilisez le format WL-XXXXXX</p>
                        )}
                        {field === 'svlan' && configFields[field] && !/^\d{1,4}$/.test(configFields[field]) && (
                          <p className="mt-1 text-sm text-red-500">Le SVLAN doit contenir entre 1 et 4 chiffres</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {((configType === 'FTTH' && provider && (provider !== 'Axione' || axioneType)) || configType === 'FTTO') && (
                  <button
                    onClick={handleGenerateConfig}
                    disabled={!isValid}
                    className={`mt-6 w-full py-3 px-4 rounded-lg ${
                      isValid
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Générer la Configuration
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center">
                  <Radio className="h-5 w-5 mr-2 text-blue-500" />
                  Configuration Générée
                </h2>
                {generatedConfig && (
                  <button
                    onClick={handleCopyConfig}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copier
                      </>
                    )}
                  </button>
                )}
              </div>

              {generatedConfig ? (
                <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-[500px] text-sm font-mono whitespace-pre">
                  {generatedConfig}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-500">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Aucune configuration générée
                </div>
              )}
            </div>
          </div>
        )}

        {section === 'SBC' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Phone className="h-5 w-5 mr-2 text-blue-500" />
                Configuration SBC
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéros (un par ligne)
                  </label>
                  <textarea
                    value={configFields.numbers || ''}
                    onChange={(e) => handleFieldChange('numbers', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                    rows={8}
                    placeholder="0130173401&#10;0130173402&#10;0130173404"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expression régulière
                  </label>
                  <input
                    type="text"
                    value={configFields.regex || ''}
                    onChange={(e) => handleFieldChange('regex', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                    placeholder='<next type="regex">!^.*$!sip:\0@OpenIPTouch-GRP!</next>'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type LRT
                  </label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleFieldChange('isCentileLRT', 'true')}
                      className={`flex-1 py-2 px-4 rounded-lg border ${
                        configFields.isCentileLRT === 'true'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Centile LRT
                    </button>
                    <button
                      onClick={() => handleFieldChange('isCentileLRT', 'false')}
                      className={`flex-1 py-2 px-4 rounded-lg border ${
                        configFields.isCentileLRT === 'false'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Standard LRT
                    </button> 
                  </div>
                </div>
                <button
                  onClick={handleGenerateConfig}
                  disabled={!isValid}
                  className={`mt-4 w-full py-3 px-4 rounded-lg ${
                    isValid
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Générer la Configuration
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center">
                  <Radio className="h-5 w-5 mr-2 text-blue-500" />
                  Configuration Générée
                </h2>
                {generatedConfig && (
                  <button
                    onClick={handleCopyConfig}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copier
                      </>
                    )}
                  </button>
                )}
              </div>

              {generatedConfig ? (
                <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-[500px] text-sm font-mono whitespace-pre">
                  {generatedConfig}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-500">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Aucune configuration générée
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2024 Network Config Generator</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
