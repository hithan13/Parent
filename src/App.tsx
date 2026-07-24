import { useState, useEffect } from 'react'
import { LayoutDashboard, Smartphone, Shield, UploadCloud, Clock, Settings, Wifi, Activity, Calendar } from 'lucide-react'
import { database, auth } from './firebase'
import { ref, onValue, set } from 'firebase/database'
import { signInAnonymously } from 'firebase/auth'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
    case 'installed_successfully':
      return '#22c55e';
    case 'failed':
    case 'download_failed':
    case 'install_failed':
      return '#ef4444';
    case 'downloading':
    case 'installing':
    case 'processing':
      return '#3b82f6';
    default:
      return 'rgba(255,255,255,0.12)';
  }
};

const getStatusBadgeBg = (status: string) => {
  switch (status) {
    case 'success':
    case 'installed_successfully':
      return 'rgba(34,197,94,0.2)';
    case 'failed':
    case 'download_failed':
    case 'install_failed':
      return 'rgba(239,68,68,0.2)';
    case 'downloading':
    case 'installing':
    case 'processing':
      return 'rgba(59,130,246,0.2)';
    default:
      return 'rgba(255,255,255,0.1)';
  }
};

const formatStatusText = (status: string) => {
  return status.toUpperCase().replace(/_/g, ' ');
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [deviceData, setDeviceData] = useState<any>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<{id: string, lastSeen: number, deviceName: string, deviceType: string}[]>([]);
  
  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deployUrl, setDeployUrl] = useState('');
  const [selfUpdateUrl, setSelfUpdateUrl] = useState('');

  useEffect(() => {
    // Authenticate anonymously to access the secure database
    signInAnonymously(auth).then(() => {
      // First, fetch the list of all devices
      const rootRef = ref(database, 'devices');
      const unsubscribeRoot = onValue(rootRef, (snapshot) => {
        const devices = snapshot.val();
        if (devices) {
          // Store all available devices for the dropdown
          const devs: {id: string, lastSeen: number, deviceName: string, deviceType: string}[] = [];
          Object.entries(devices).forEach(([id, device]: [string, any]) => {
            if (id !== 'test_device_001') {
              devs.push({
                id,
                lastSeen: device.lastSeen || 0,
                deviceName: device.deviceName || id.substring(0, 8) + '...',
                deviceType: device.deviceType || 'device',
              });
            }
          });
          // Sort by most recently seen
          devs.sort((a, b) => b.lastSeen - a.lastSeen);
          setAvailableDevices(devs);
          
          setActiveDeviceId((currentId) => {
            if (!currentId || !devs.find(d => d.id === currentId)) {
              return devs.length > 0 ? devs[0].id : null;
            }
            return currentId;
          });
        } else {
          setDbError("Waiting for a device to connect... Please open the Android app.");
        }
      }, (error) => {
        console.error("Root Firebase read error:", error);
        setDbError(`Permission Denied: Could not read from Firebase (${error.message}).`);
      });

      return () => unsubscribeRoot();
    }).catch((err) => {
      console.error("Auth error:", err);
      setDbError("Authentication failed. Please ensure 'Anonymous' sign-in is enabled in Firebase Authentication.");
    });
  }, []);

  useEffect(() => {
    if (!activeDeviceId) return;

    const deviceRef = ref(database, `devices/${activeDeviceId}`);
    const unsubscribe = onValue(deviceRef, (devSnapshot) => {
      const data = devSnapshot.val();
      if (data) {
        setDeviceData(data);
        setDbError(null);
      } else {
        // Initialize default data if none exists
        const defaultData = {
          kioskModeEnabled: true,
          safeBrowsing: true,
          wifiEnabled: true,
          cameraDisabled: false,
          timeProfile: 'Morning',
          allowedApps: {
            'com_google_android_youtube': true,
            'com_android_chrome': false,
            'org_videolan_vlc': true
          }
        };
        set(deviceRef, defaultData).then(() => {
           setDeviceData(defaultData);
           setDbError(null);
        }).catch((err) => {
           console.error("Firebase write error:", err);
           setDbError("Permission Denied: Could not write to Firebase.");
        });
      }
    }, (error) => {
      console.error("Firebase read error:", error);
      setDbError(`Permission Denied: Could not read from Firebase (${error.message}).`);
    });

    return () => unsubscribe();
  }, [activeDeviceId]);

  const toggleKioskMode = () => {
    if (!deviceData || !activeDeviceId) return;
    set(ref(database, `devices/${activeDeviceId}/kioskModeEnabled`), !deviceData.kioskModeEnabled);
  };

  const toggleWifi = () => {
    if (!deviceData || !activeDeviceId) return;
    set(ref(database, `devices/${activeDeviceId}/wifiEnabled`), !deviceData.wifiEnabled);
  };

  const toggleCamera = () => {
    if (!deviceData || !activeDeviceId) return;
    set(ref(database, `devices/${activeDeviceId}/cameraDisabled`), !deviceData.cameraDisabled);
  };

  const changeTimeProfile = (profile: string) => {
    if (!activeDeviceId || !deviceData) return;
    
    const profileNode = deviceData.profiles?.[profile];
    const isNewStructure = profileNode && ('apps' in profileNode || 'wifiEnabled' in profileNode || 'cameraDisabled' in profileNode || 'kioskModeEnabled' in profileNode);
    
    const profileApps = isNewStructure ? profileNode?.apps : profileNode;
    const wifiEnabled = isNewStructure ? (profileNode?.wifiEnabled !== false) : true;
    const cameraDisabled = isNewStructure ? (profileNode?.cameraDisabled === true) : false;
    const kioskModeEnabled = isNewStructure ? (profileNode?.kioskModeEnabled === true) : false;
    
    // Set active profile
    set(ref(database, `devices/${activeDeviceId}/timeProfile`), profile);
    
    // Apply this profile's rules to the device instantly
    if (profileApps && Object.keys(profileApps).length > 0) {
      set(ref(database, `devices/${activeDeviceId}/allowedApps`), profileApps);
    } else {
      set(ref(database, `devices/${activeDeviceId}/allowedApps`), null);
    }
    
    set(ref(database, `devices/${activeDeviceId}/wifiEnabled`), wifiEnabled);
    set(ref(database, `devices/${activeDeviceId}/cameraDisabled`), cameraDisabled);
    set(ref(database, `devices/${activeDeviceId}/kioskModeEnabled`), kioskModeEnabled);
  };

  const setProfileTime = (profile: string, time: string) => {
    if (!activeDeviceId) return;
    set(ref(database, `devices/${activeDeviceId}/profileTimes/${profile}`), time);
  };

  const toggleProfileSetting = (profile: string, setting: 'wifiEnabled' | 'cameraDisabled' | 'kioskModeEnabled') => {
    if (!activeDeviceId || !deviceData) return;
    const profileNode = deviceData.profiles?.[profile] || {};
    const isNewStructure = 'apps' in profileNode || 'wifiEnabled' in profileNode || 'cameraDisabled' in profileNode || 'kioskModeEnabled' in profileNode;
    
    let currentVal = false;
    if (setting === 'wifiEnabled') {
      currentVal = isNewStructure ? (profileNode.wifiEnabled !== false) : true;
    } else if (setting === 'cameraDisabled') {
      currentVal = isNewStructure ? (profileNode.cameraDisabled === true) : false;
    } else if (setting === 'kioskModeEnabled') {
      currentVal = isNewStructure ? (profileNode.kioskModeEnabled === true) : false;
    }
    
    const newVal = !currentVal;
    
    if (!isNewStructure) {
      const apps = { ...profileNode };
      const updatedProfile = {
        apps,
        wifiEnabled: setting === 'wifiEnabled' ? newVal : true,
        cameraDisabled: setting === 'cameraDisabled' ? newVal : false,
        kioskModeEnabled: setting === 'kioskModeEnabled' ? newVal : false,
        screenTimeLimit: -1
      };
      set(ref(database, `devices/${activeDeviceId}/profiles/${profile}`), updatedProfile);
    } else {
      set(ref(database, `devices/${activeDeviceId}/profiles/${profile}/${setting}`), newVal);
    }

    if (deviceData.timeProfile === profile) {
      set(ref(database, `devices/${activeDeviceId}/${setting}`), newVal);
    }
  };

  const setProfileScreenTimeLimit = (profile: string, limitMinutes: number) => {
    if (!activeDeviceId || !deviceData) return;
    const profileNode = deviceData.profiles?.[profile] || {};
    const isNewStructure = 'apps' in profileNode || 'wifiEnabled' in profileNode || 'cameraDisabled' in profileNode || 'kioskModeEnabled' in profileNode;
    
    if (!isNewStructure) {
      const apps = { ...profileNode };
      const updatedProfile = {
        apps,
        wifiEnabled: true,
        cameraDisabled: false,
        kioskModeEnabled: false,
        screenTimeLimit: limitMinutes
      };
      set(ref(database, `devices/${activeDeviceId}/profiles/${profile}`), updatedProfile);
    } else {
      set(ref(database, `devices/${activeDeviceId}/profiles/${profile}/screenTimeLimit`), limitMinutes);
    }
  };

  const handleUrlDeploy = async () => {
    if (!deployUrl.trim() || !activeDeviceId) return;
    try {
      let finalUrl = deployUrl.trim();
      let type = 'apk'; // Default to apk since this is in the Large APKs section
      
      // Transform Google Drive links to direct downloads with confirm=t to bypass virus scan warning
      if (finalUrl.includes('drive.google.com/file/d/')) {
        const matches = finalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (matches && matches[1]) {
          finalUrl = `https://drive.usercontent.google.com/download?id=${matches[1]}&export=download&confirm=t`;
        }
      } else if (finalUrl.includes('dropbox.com')) {
        // Transform Dropbox links to direct downloads
        finalUrl = finalUrl.replace(/\?dl=0$/, '?dl=1').replace(/&dl=0$/, '&dl=1');
      } else {
        // If not Drive/Dropbox and doesn't contain '.apk', fallback to media (though usually it will be apk)
        if (!finalUrl.toLowerCase().includes('.apk')) {
          type = 'media';
        }
      }
      
      const filename = type === 'apk' ? 'downloaded_app.apk' : 'downloaded_media';

      await set(ref(database, `devices/${activeDeviceId}/deployCommand`), {
        url: finalUrl,
        type: type,
        filename: filename,
        timestamp: Date.now()
      });
      alert('Deployment command sent successfully via URL!');
      setDeployUrl('');
    } catch (err) {
      console.error('URL deployment failed', err);
      alert('Failed to send command. Check your connection.');
    }
  };

  const handleSelfUpdate = async () => {
    if (!selfUpdateUrl.trim() || !activeDeviceId) return;
    if (!window.confirm('This will silently install the new version of the Guardian MDM app on the child device. The service will restart automatically. Continue?')) return;
    try {
      let finalUrl = selfUpdateUrl.trim();
      // Transform Google Drive share links to direct download
      if (finalUrl.includes('drive.google.com/file/d/')) {
        const matches = finalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (matches && matches[1]) {
          finalUrl = `https://drive.usercontent.google.com/download?id=${matches[1]}&export=download&confirm=t`;
        }
      }
      await set(ref(database, `devices/${activeDeviceId}/deployCommand`), {
        url: finalUrl,
        type: 'self_update',
        filename: 'guardian_mdm_update.apk',
        timestamp: Date.now()
      });
      alert('✅ Update command sent! The device will silently install the new version and restart.');
      setSelfUpdateUrl('');
    } catch (err) {
      console.error('Self-update deployment failed', err);
      alert('Failed to send update command. Check your connection.');
    }
  };


  const handleUpload = () => {
    if (!uploadFile || !activeDeviceId) return;
    
    // 7MB strict limit for Realtime Database Base64 storage
    if (uploadFile.size > 7 * 1024 * 1024) {
      alert("File is too large for auto-upload (Max 7MB). For larger files like APKs, please use the 'Paste Direct Link' option below.");
      return;
    }
    
    setUploading(true);
    setUploadProgress(20);
    
    try {
      const type = uploadFile.name.endsWith('.apk') ? 'apk' : 'media';
      
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = 20 + ((event.loaded / event.total) * 60);
          setUploadProgress(progress);
        }
      };

      reader.onload = async (e) => {
        const base64Data = e.target?.result;
        
        if (!base64Data) {
          alert('Failed to read file');
          setUploading(false);
          return;
        }
        
        setUploadProgress(90);

        try {
          // Send the file directly through the Realtime Database!
          await set(ref(database, `devices/${activeDeviceId}/deployCommand`), {
            url: base64Data, // This is now a base64 string instead of a web URL
            type: type,
            filename: uploadFile.name,
            timestamp: Date.now()
          });
          
          setUploadProgress(100);
          alert('Note sent to device successfully (via free Database)!');
        } catch (err) {
          console.error('Database write failed', err);
          alert('Failed to save to database. Check your connection.');
        } finally {
          setUploading(false);
          setUploadFile(null);
          setTimeout(() => setUploadProgress(0), 2000);
        }
      };

      reader.onerror = () => {
        console.error("Failed to read file");
        alert("Failed to read the file. Please try again.");
        setUploading(false);
        setUploadProgress(0);
      };
      
      // Read the file as a Base64 string
      reader.readAsDataURL(uploadFile);
      
    } catch (err) {
      console.error('Upload initiation failed', err);
      setUploading(false);
      setUploadFile(null);
      setUploadProgress(0);
    }
  };

  const toggleApp = (packageName: string) => {
    if (!deviceData || !activeDeviceId) return;
    const fbKey = packageName.replace(/\./g, '_');
    const currentProfile = deviceData.timeProfile || 'Evening';
    
    const profileNode = deviceData.profiles?.[currentProfile] || {};
    const isNewStructure = 'apps' in profileNode || 'wifiEnabled' in profileNode || 'cameraDisabled' in profileNode || 'kioskModeEnabled' in profileNode;
    
    const profileApps = isNewStructure ? profileNode.apps : profileNode;
    const currentState = profileApps?.[fbKey] || false;
    const newState = !currentState;
    
    if (!isNewStructure) {
      // Migrate flat layout to new nested layout
      const apps = { ...profileNode };
      apps[fbKey] = newState;
      const updatedProfile = {
        apps,
        wifiEnabled: true,
        cameraDisabled: false,
        kioskModeEnabled: false,
        screenTimeLimit: -1
      };
      set(ref(database, `devices/${activeDeviceId}/profiles/${currentProfile}`), updatedProfile);
    } else {
      set(ref(database, `devices/${activeDeviceId}/profiles/${currentProfile}/apps/${fbKey}`), newState);
    }
    
    // Push directly to device since it is the active profile
    set(ref(database, `devices/${activeDeviceId}/allowedApps/${fbKey}`), newState);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderContent = () => {
    if (dbError) {
      return (
        <div style={{ padding: '40px' }}>
          <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Database Connection Error</h3>
            <p style={{ margin: 0 }}>{dbError}</p>
          </div>
        </div>
      );
    }

    if (!deviceData) {
      return (
        <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
          Loading dashboard data...
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <div className="header">
              <h1>Device Overview</h1>
              <p>Manage and monitor connected child devices</p>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: (deviceData && deviceData.lastSeen && Date.now() - deviceData.lastSeen < 2*60*1000) ? '#22c55e' : '#ef4444', marginRight: '6px' }}></span>
                <span style={{ color: (deviceData && deviceData.lastSeen && Date.now() - deviceData.lastSeen < 2*60*1000) ? '#22c55e' : '#ef4444' }}>
                  {deviceData && deviceData.lastSeen && Date.now() - deviceData.lastSeen < 2*60*1000 ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="grid-cards">
              <div className="card glass-panel">
                <div className="card-header">
                  <Shield className="card-icon" />
                  Protection Status
                </div>
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Kiosk Mode</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={deviceData.kioskModeEnabled} onChange={toggleKioskMode} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="card glass-panel">
                <div className="card-header">
                  <Wifi className="card-icon" />
                  Network Control
                </div>
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Internet Access</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={deviceData.wifiEnabled} onChange={toggleWifi} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="card glass-panel">
                <div className="card-header">
                  <Activity className="card-icon" />
                  Data Usage Since Boot
                </div>
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Wi-Fi Data</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatBytes(deviceData.dataUsage?.wifiBytes || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mobile Data</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatBytes(deviceData.dataUsage?.mobileBytes || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
                <div className="card-header">
                  <Calendar className="card-icon" />
                  Daily Data Usage History
                </div>
                <div style={{ marginTop: '10px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 5px' }}>Date</th>
                        <th style={{ padding: '10px 5px' }}>Wi-Fi Data</th>
                        <th style={{ padding: '10px 5px' }}>Mobile Data</th>
                        <th style={{ padding: '10px 5px' }}>Total Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceData.dataUsageHistory ? (
                        Object.entries(deviceData.dataUsageHistory)
                          .sort((a, b) => b[0].localeCompare(a[0])) // Sort descending by date
                          .map(([date, usage]: [string, any]) => {
                            const wifi = usage.wifiBytes || 0;
                            const mobile = usage.mobileBytes || 0;
                            const total = wifi + mobile;
                            return (
                              <tr key={date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px 5px', fontWeight: 500 }}>{date}</td>
                                <td style={{ padding: '12px 5px', color: 'var(--text-primary)' }}>{formatBytes(wifi)}</td>
                                <td style={{ padding: '12px 5px', color: 'var(--text-primary)' }}>{formatBytes(mobile)}</td>
                                <td style={{ padding: '12px 5px', fontWeight: 600, color: 'var(--primary-light)' }}>{formatBytes(total)}</td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '20px 5px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No data usage history logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        );
      case 'apps':
        return (
          <>
            <div className="header">
              <h1>App Management</h1>
              <p>Control which apps are visible and allowed on the device</p>
            </div>
            <div className="card glass-panel">
              <div className="card-header" style={{ marginBottom: '20px' }}>
                Allowed Apps ({deviceData.timeProfile} Profile)
              </div>
              <div className="app-list">
                {deviceData.installedApps ? Object.entries(deviceData.installedApps).map(([fbKey, appName]) => (
                  <div className="app-item" key={fbKey}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                        {String(appName).charAt(0).toUpperCase()}
                      </div>
                      <span>{String(appName)}</span>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={(() => {
                          const profileNode = deviceData.profiles?.[deviceData.timeProfile || 'Evening'];
                          const isNew = profileNode && ('apps' in profileNode || 'wifiEnabled' in profileNode);
                          const profileApps = isNew ? profileNode.apps : profileNode;
                          return profileApps?.[fbKey] || false;
                        })()} 
                        onChange={() => toggleApp(fbKey.replace(/_/g, '.'))} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                )) : <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Waiting for installed apps to sync from device...</div>}
              </div>
            </div>
          </>
        );
      case 'time':
        return (
          <>
            <div className="header">
              <h1>Time Profiles</h1>
              <p>Configure which apps are allowed based on the time of day</p>
            </div>
            
            <div className="card glass-panel" style={{ marginBottom: '24px' }}>
              <div className="card-header">Active Profile</div>
              <p style={{ color: 'var(--text-muted)' }}>Currently enforcing: <strong>{deviceData.timeProfile || 'None'}</strong></p>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <button 
                  className="primary" 
                  style={{ background: deviceData.timeProfile === 'Morning' ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}
                  onClick={() => changeTimeProfile('Morning')}
                >
                  Morning
                </button>
                <button 
                  className="primary" 
                  style={{ background: deviceData.timeProfile === 'Evening' ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}
                  onClick={() => changeTimeProfile('Evening')}
                >
                  Evening
                </button>
                <button 
                  className="primary" 
                  style={{ background: deviceData.timeProfile === 'Bedtime' ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}
                  onClick={() => changeTimeProfile('Bedtime')}
                >
                  Bedtime
                </button>
              </div>
            </div>

            <div className="card glass-panel" style={{ marginBottom: '24px' }}>
              <div className="card-header">Automated Scheduling</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Set the time when each profile should automatically activate.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {['Morning', 'Evening', 'Bedtime'].map(profile => (
                  <div key={profile} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>{profile} Starts At</span>
                    <input 
                      type="time" 
                      value={deviceData.profileTimes?.[profile] || (profile === 'Morning' ? '07:00' : profile === 'Evening' ? '16:00' : '21:00')}
                      onChange={(e) => setProfileTime(profile, e.target.value)}
                      style={{ 
                        background: 'rgba(0,0,0,0.3)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        color: 'white', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        fontSize: '16px'
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-panel" style={{ marginBottom: '24px' }}>
              <div className="card-header">Profile Specific Rules</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                Configure custom rule permissions and screen time limits for each profile.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {['Morning', 'Evening', 'Bedtime'].map(profile => {
                  const profileNode = deviceData.profiles?.[profile] || {};
                  const isNew = 'apps' in profileNode || 'wifiEnabled' in profileNode || 'cameraDisabled' in profileNode || 'kioskModeEnabled' in profileNode;
                  
                  const wifi = isNew ? (profileNode.wifiEnabled !== false) : true;
                  const camera = isNew ? (profileNode.cameraDisabled === true) : false;
                  const kiosk = isNew ? (profileNode.kioskModeEnabled === true) : false;
                  const limit = isNew ? (profileNode.screenTimeLimit || -1) : -1;
                  
                  return (
                    <div key={profile} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: profile === 'Morning' ? '#fbbf24' : profile === 'Evening' ? '#f97316' : '#6366f1' }}></span>
                        {profile} Profile
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px' }}>🌐 Internet Access</span>
                          <label className="toggle-switch">
                            <input 
                              type="checkbox" 
                              checked={wifi} 
                              onChange={() => toggleProfileSetting(profile, 'wifiEnabled')} 
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px' }}>📷 Block Camera</span>
                          <label className="toggle-switch">
                            <input 
                              type="checkbox" 
                              checked={camera} 
                              onChange={() => toggleProfileSetting(profile, 'cameraDisabled')} 
                            />
                            <span className="slider"></span>
                          </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px' }}>🔒 Enforce Kiosk Mode</span>
                          <label className="toggle-switch">
                            <input 
                              type="checkbox" 
                              checked={kiosk} 
                              onChange={() => toggleProfileSetting(profile, 'kioskModeEnabled')} 
                            />
                            <span className="slider"></span>
                          </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>⏳ Daily Screen Time Limit</span>
                          <select
                            value={limit}
                            onChange={(e) => setProfileScreenTimeLimit(profile, parseInt(e.target.value))}
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'white',
                              padding: '8px',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value={-1} style={{ background: '#1e293b' }}>Unlimited</option>
                            <option value={15} style={{ background: '#1e293b' }}>15 Minutes</option>
                            <option value={30} style={{ background: '#1e293b' }}>30 Minutes</option>
                            <option value={60} style={{ background: '#1e293b' }}>1 Hour</option>
                            <option value={120} style={{ background: '#1e293b' }}>2 Hours</option>
                            <option value={180} style={{ background: '#1e293b' }}>3 Hours</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      case 'deploy':
        return (
          <>
            <div className="header">
              <h1>Deploy APKs & Media</h1>
              <p>Upload files directly to the child's device</p>
            </div>
            
            <div className="card glass-panel" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <UploadCloud className="card-icon" />
                Auto-Upload (Small Files)
              </div>
              
              <div style={{ marginTop: '20px', border: '2px dashed rgba(255,255,255,0.2)', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
                <input 
                  type="file" 
                  id="file-upload" 
                  style={{ display: 'none' }} 
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  accept=".apk,video/*,image/*,.pdf,application/pdf"
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'inline-block' }}>
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'inline-block', marginBottom: '16px' }}>
                    <UploadCloud size={32} />
                  </div>
                  <h3>{uploadFile ? uploadFile.name : "Click to select Photo or PDF note"}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Fast upload for files under 7MB.</p>
                </label>
              </div>
              
              {uploading && (
                <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, background: 'var(--primary)', height: '100%', transition: 'width 0.3s ease' }}></div>
                </div>
              )}
              
              <button 
                className="primary" 
                style={{ marginTop: '24px', opacity: !uploadFile || uploading ? 0.5 : 1 }} 
                disabled={!uploadFile || uploading}
                onClick={handleUpload}
              >
                {uploading ? 'Uploading...' : 'Deploy to Device'}
              </button>
            </div>

            <div className="card glass-panel">
              <div className="card-header">
                <UploadCloud className="card-icon" />
                Large APKs (Paste Direct Link)
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '12px', marginBottom: '20px' }}>
                For files up to 50MB+ (like APKs), upload them to Google Drive or Dropbox, copy the direct link, and paste it here.
              </p>
              
              <input 
                type="text" 
                placeholder="https://drive.google.com/..." 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '16px' }}
                value={deployUrl}
                onChange={(e) => setDeployUrl(e.target.value)}
              />
              
              <button 
                className="primary" 
                style={{ opacity: !deployUrl.trim() ? 0.5 : 1 }} 
                disabled={!deployUrl.trim()}
                onClick={handleUrlDeploy}
              >
                Deploy via URL
              </button>
            </div>

            {/* Self-Update Card */}
            <div className="card glass-panel" style={{ marginBottom: '24px', borderLeft: '4px solid #6366f1' }}>
              <div className="card-header">
                <Activity className="card-icon" style={{ color: '#6366f1' }} />
                Update Guardian MDM App
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '12px', marginBottom: '20px' }}>
                Upload the new <strong style={{ color: 'white' }}>ParentalControl.apk</strong> to Google Drive, copy the shareable link, and paste it below.
                The device will <strong style={{ color: '#a5b4fc' }}>silently install the update</strong> in the background with no popups.
              </p>
              <input
                type="text"
                placeholder="https://drive.google.com/file/d/..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)', color: 'white', marginBottom: '16px' }}
                value={selfUpdateUrl}
                onChange={(e) => setSelfUpdateUrl(e.target.value)}
              />
              <button
                className="primary"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', opacity: !selfUpdateUrl.trim() ? 0.5 : 1 }}
                disabled={!selfUpdateUrl.trim()}
                onClick={handleSelfUpdate}
              >
                🚀 Push Update to Device
              </button>
            </div>

            {deviceData.deployStatus && (
              <div className="card glass-panel" style={{ marginTop: '24px', borderLeft: `4px solid ${getStatusColor(deviceData.deployStatus.status)}` }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} style={{ color: getStatusColor(deviceData.deployStatus.status) }} />
                    <span>Deployment Status Feedback</span>
                  </div>
                  <span className="badge" style={{ 
                    background: getStatusBadgeBg(deviceData.deployStatus.status), 
                    color: getStatusColor(deviceData.deployStatus.status),
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    border: `1px solid ${getStatusColor(deviceData.deployStatus.status)}`
                  }}>
                    {formatStatusText(deviceData.deployStatus.status)}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '15px', color: 'white' }}>{deviceData.deployStatus.filename || 'Unknown File'}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', lineHeight: '1.4' }}>
                    {deviceData.deployStatus.message || 'Processing command...'}
                  </p>
                  {deviceData.deployStatus.timestamp && (
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '12px', textAlign: 'right' }}>
                      Last updated: {new Date(deviceData.deployStatus.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        );
      case 'settings':
        return (
          <>
            <div className="header">
              <h1>Device Settings</h1>
              <p>Deep hardware and system configurations</p>
            </div>
            <div className="card glass-panel">
              <div className="card-header">Hardware Restrictions</div>
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>Disable Camera</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completely locks the device camera hardware</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={deviceData.cameraDisabled || false} onChange={toggleCamera} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </>
        );
      default:
        return (
          <div className="header">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p>This section is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar glass-panel">
        <div className="sidebar-brand">Guardian MDM</div>
        
        <div className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={20} /> Dashboard
        </div>
        <div className={`sidebar-item ${activeTab === 'apps' ? 'active' : ''}`} onClick={() => setActiveTab('apps')}>
          <Smartphone size={20} /> App Management
        </div>
        <div className={`sidebar-item ${activeTab === 'time' ? 'active' : ''}`} onClick={() => setActiveTab('time')}>
          <Clock size={20} /> Time Profiles
        </div>
        <div className={`sidebar-item ${activeTab === 'deploy' ? 'active' : ''}`} onClick={() => setActiveTab('deploy')}>
          <UploadCloud size={20} /> Deploy APKs / Media
        </div>
        <div className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={20} /> Settings
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Device Picker Header Bar */}
        {availableDevices.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <Smartphone size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', flexShrink: 0 }}>Active Device:</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableDevices.map(dev => (
                <button
                  key={dev.id}
                  onClick={() => setActiveDeviceId(dev.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    background: activeDeviceId === dev.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                    borderColor: activeDeviceId === dev.id ? '#6366f1' : 'rgba(255,255,255,0.12)',
                    color: activeDeviceId === dev.id ? '#a5b4fc' : 'var(--text-muted)',
                  }}
                >
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: dev.deviceType === 'emulator' ? '#f59e0b' : '#22c55e',
                  }} />
                  {dev.deviceName}
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: dev.deviceType === 'emulator' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)',
                    color: dev.deviceType === 'emulator' ? '#fbbf24' : '#4ade80',
                  }}>
                    {dev.deviceType === 'emulator' ? 'Emulator' : 'Real Device'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default App
