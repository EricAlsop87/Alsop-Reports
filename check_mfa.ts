import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) env[key.trim()] = vals.join('=').trim()
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRole)

async function checkUserSession() {
  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error(error)
    return
  }
  const user = users.users.find((u: any) => u.email === 'carlospaz@allstate.com')
  if (user) {
    console.log('User found:', user.email)
    const { data: factors } = await supabase.auth.admin.mfa.listFactors({
      userId: user.id
    })
    console.log('Factors:', JSON.stringify(factors, null, 2))
  }
}

checkUserSession()
